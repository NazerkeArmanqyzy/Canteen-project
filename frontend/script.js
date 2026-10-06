const get = selector => document.querySelector(selector);
const apiUrl = location.port === "3000" ? location.origin : "http://localhost:3000";
const recommendations = get("#recommendations");
const container = get("#products") || recommendations;
const template = get("#product-template");
const cartItems = get("#cart-items");
const search = get("#search"), sort = get("#sort");
const categoryButtons = document.querySelectorAll(".c3");
const form = get("#order-form");
const nameInput = get("#customer-name"), groupInput = get("#student-group");
const orderButton = get("#order-button");
const orderMessage = get("#order-message");
const cartKey = "jihc-canteen-cart", favoritesKey = "jihc-canteen-favorites";
const isFavorites = location.pathname.endsWith("favorites.html");
const categoryNames = { chocolate: "Chocolate", juices: "Juices & Drinks", snacks: "Snacks", sandwiches: "Sandwiches" };
const emoji = { chocolate: "🍫", juices: "🧃", snacks: "🍿", sandwiches: "🥪" };
const productImages = {
    "bruni": "bruni.jpeg", "snickers": "snickers.jpeg", "bounty": "bounty.webp", "albeni": "albeni.png", "kitkat": "kitkat.jpeg", "barni": "barni.webp",
    "oreo": "oreo.jpeg", "mars": "mars.jpg", "twix": "twix.jpg", "chicken sandwich": "chicken-sandwich.jpg", "sausage sandwich": "sausage-sandwich.jpg", "chicken samsa": "chicken-samsa.jpg",
    "toast": "toast.jpg", "egg toast": "egg-toast.jpg", "pepsi": "pepsi.jpg", "maxi tea": "maxi-tea.jpg", "apple juice": "apple-juice.jpg", "mojito": "mojito.jpg",
    "still water": "still-water.jpg", "chips": "chips.jpg", "kirieshki": "kirieshki.jpg", "khrum": "khrum.jpg", "ozera": "ozera.jpeg"
};
let products = [], cart = [];
let favoriteIds = readStorage(favoritesKey).filter(Number.isInteger);
let category = "all";
let ready = false, busy = false, loading = false;
function readStorage(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}
function saveStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (error) { console.error(error); }
}
function validProduct(item) {
    return item && Number.isInteger(item.id) && item.id > 0 &&
        typeof item.name === "string" && item.name.trim() !== "" &&
        ["number", "string"].includes(typeof item.price) &&
        String(item.price).trim() !== "" && Number.isFinite(Number(item.price)) && Number(item.price) >= 0;
}
for (const item of readStorage(cartKey)) {
    if (!validProduct(item) || cart.some(value => value.id === item.id)) continue;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) continue;
    cart.push({ id: item.id, name: item.name.trim(), price: Number(item.price), quantity: item.quantity });
}
function find(list, id) { return list.find(item => item.id === id); }
function price(value) { return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }
function text(selector, value, parent = document) {
    const node = parent.querySelector(selector); if (node) node.textContent = value;
}
function element(tag, text = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text; node.className = className;
    return node;
}
function button(text, label, action) {
    const node = element("button", text);
    node.type = "button"; node.setAttribute("aria-label", label);
    node.addEventListener("click", action); node.disabled = busy;
    return node;
}
function message(text, type = "") {
    if (orderMessage) { orderMessage.textContent = text; orderMessage.className = "i4 " + type; }
}
function menuMessage(text) { container?.replaceChildren(element("p", text)); }
function showProducts() {
    if (!ready || !container || !template) return;
    const query = search ? search.value.trim().toLowerCase() : "";
    let visible = products.filter(item =>
        (category === "all" || item.category === category) &&
        item.name.toLowerCase().includes(query) &&
        (!isFavorites || favoriteIds.includes(item.id)) &&
        (!recommendations || ["Chicken Sandwich", "Apple Juice", "Ozera"].includes(item.name))
    );
    if (sort && sort.value === "low") visible.sort((a, b) => a.price - b.price);
    if (sort && sort.value === "high") visible.sort((a, b) => b.price - a.price);
    container.replaceChildren();
    for (const item of visible) {
        const card = template.content.querySelector(".d1").cloneNode(true);
        card.dataset.category = item.category;
        text(".d3", categoryNames[item.category] || item.category, card);
        text(".d5 h3", item.name, card);
        text(".d5 p", price(item.price) + " ₸", card);
        const icon = card.querySelector(".d4");
        icon.textContent = emoji[item.category] || "🍽️";
        const file = productImages[item.name.trim().toLowerCase().replace(/\s+/g, " ")];
        if (file) {
            const image = document.createElement("img");
            image.src = apiUrl + "/assets/" + file; image.alt = item.name;
            image.addEventListener("error", () => image.replaceWith(icon));
            icon.replaceWith(image);
        }
        const add = card.querySelector(".d7");
        add.addEventListener("click", () => {
            if (!addToCart(item.id)) return;
            add.textContent = "Added ✓";
            text("#feedback", item.name + " added to Cart.");
        });
        card.querySelector(".d8").addEventListener("click", () => { if (addToCart(item.id)) location.href = "cart.html"; });
        const heart = card.querySelector(".j1");
        const saved = favoriteIds.includes(item.id);
        heart.textContent = saved ? "♥" : "♡";
        heart.setAttribute("aria-pressed", String(saved));
        heart.setAttribute("aria-label", (saved ? "Remove " : "Save ") + item.name + " in favorites");
        heart.addEventListener("click", () => {
            if (busy) return; favoriteIds = saved ? favoriteIds.filter(id => id !== item.id) : [...favoriteIds, item.id];
            saveStorage(favoritesKey, favoriteIds); showProducts();
        });
        container.append(card);
    }
    if (!visible.length) menuMessage(isFavorites ? "No favorites yet. Save food with ♡ on Menu." : "No food found.");
}
async function loadProducts() {
    if (busy || loading) return; loading = true; ready = false; updateOrderButton();
    menuMessage("Loading menu...");
    try {
        const response = await fetch(apiUrl + "/products");
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error("Could not load menu.");
        const ids = new Set();
        products = data.map(item => {
            if (!validProduct(item) || ids.has(item.id) || !item.category?.trim()) throw new Error("Invalid product.");
            ids.add(item.id);
            return { ...item, name: item.name.trim(), price: Number(item.price), category: item.category.trim().toLowerCase() };
        });
        cart = cart.filter(item => find(products, item.id));
        cart = cart.map(item => ({ ...find(products, item.id), quantity: item.quantity }));
        ready = true; updateCart(); showProducts();
    } catch (error) {
        products = [];
        menuMessage("Could not load menu. Check the server and try again.");
        const retry = button("Try again", "Load menu again", loadProducts);
        retry.className = "d9"; container?.append(retry);
        console.error(error);
    } finally {
        loading = false; text('[data-category="all"] span', products.length);
        updateOrderButton();
    }
}
function addToCart(id) {
    if (busy || !ready) return false;
    const item = find(cart, id);
    if (item) return changeQuantity(id, 1);
    const product = find(products, id);
    if (!product) return false;
    cart.push({ id, name: product.name, price: product.price, quantity: 1 });
    updateCart();
    return true;
}
function changeQuantity(id, change) {
    if (busy) return false;
    const item = find(cart, id);
    if (!item) return false;
    if (item.quantity + change > 100) return message("Maximum quantity per product is 100.", "error");
    item.quantity += change;
    cart = cart.filter(item => item.quantity > 0); updateCart();
    return true;
}
function updateCart() {
    saveStorage(cartKey, cart); message("");
    text("#cart-count", cart.reduce((sum, item) => sum + item.quantity, 0));
    if (cartItems) {
        cartItems.replaceChildren();
        if (!cart.length) cartItems.append(element("p", "Your cart is empty."));
        let cents = 0;
        for (const item of cart) {
            const row = element("div", "", "g2");
            const info = element("div", "", "g3");
            info.append(element("h3", item.name), element("p", price(item.price) + " ₸ each"));
            const controls = element("div", "", "g4");
            for (const [label, change] of [["−", -1], ["+", 1], ["Remove", -item.quantity]]) {
                const control = button(label, label + " " + item.name, () => changeQuantity(item.id, change));
                if (label === "Remove") control.className = "g6";
                controls.append(control);
                if (label === "−") controls.append(element("span", item.quantity));
            }
            const subtotal = Math.round(item.price * 100) * item.quantity;
            row.append(info, controls, element("strong", price(subtotal / 100) + " ₸", "g5"));
            cartItems.append(row);
            cents += subtotal;
        }
        text("#total", price(cents / 100));
    }
    updateOrderButton();
}
function updateOrderButton() { if (orderButton) orderButton.disabled = busy || !ready || !cart.length; }
function setBusy(value) {
    busy = value;
    nameInput.disabled = value; groupInput.disabled = value; form.setAttribute("aria-busy", String(value));
    orderButton.textContent = value ? "Sending..." : "Place Order";
    for (const node of document.querySelectorAll("#products button, #recommendations button, #cart-items button")) node.disabled = value;
    updateOrderButton();
}
form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    if (!ready || !cart.length) return message("Load the menu and add food to your cart first.", "error");
    const name = nameInput.value.trim();
    const group = groupInput.value.trim();
    if (!name || !group) return message("Enter your name and group.", "error");
    if (name.length > 100 || group.length > 50) return message("Name or group is too long.", "error");
    const purchased = cart.map(item => ({ ...item }));
    const items = cart.map(item => ({ product_id: item.id, quantity: item.quantity }));
    message(""); setBusy(true);
    try {
        const response = await fetch(apiUrl + "/orders", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, group, items })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) return message(data?.message || "Could not place your order.", "error");
        cart = []; updateCart(); form.reset();
        message("Your order was placed successfully!", "success");
        const confirmation = get("#confirmation");
        if (confirmation) {
            confirmation.hidden = false;
            text("#confirmation-title", data?.order?.id ? "Order #" + data.order.id + " confirmed ✓" : "Order confirmed ✓");
            const list = get("#confirmation-items");
            list.replaceChildren();
            for (const item of purchased) list.append(element("p", item.name + " × " + item.quantity + " — " + price(item.price * item.quantity) + " ₸"));
            const amount = Number.isFinite(data?.total) ? data.total : purchased.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
            text("#confirmation-total", "Total: " + price(amount) + " ₸ · Collect at the canteen");
            confirmation.scrollIntoView({ behavior: "smooth" });
        }
    } catch (error) {
        message("Could not confirm your order. Your cart has been kept. Check with the canteen before submitting again.", "error");
        console.error(error);
    } finally { setBusy(false); }
});
search?.addEventListener("input", showProducts);
sort?.addEventListener("change", showProducts);
get(".b1")?.addEventListener("submit", event => { event.preventDefault(); showProducts(); });
for (const node of categoryButtons) {
    node.addEventListener("click", () => {
        category = node.dataset.category;
        categoryButtons.forEach(item => item.classList.toggle("c4", item === node));
        showProducts();
    });
}
updateCart(); loadProducts();