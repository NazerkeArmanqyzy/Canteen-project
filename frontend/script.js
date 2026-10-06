// Адрес backend-сервера.
const apiUrl = location.port === "3000" ? location.origin : "http://localhost:3000";

const productsContainer = document.querySelector("#products");
const productTemplate = document.querySelector("#product-template");

const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const total = document.querySelector("#total");

const search = document.querySelector("#search");
const searchForm = document.querySelector(".b1");
const categoryButtons = document.querySelectorAll(".c3");

const orderForm = document.querySelector("#order-form");
const customerName = document.querySelector("#customer-name");
const studentGroup = document.querySelector("#student-group");
const orderButton = document.querySelector("#order-button");
const orderMessage = document.querySelector("#order-message");

let products = [];
let cart = [];
let selectedCategory = "all";
let menuState = "idle";
let isSubmitting = false;

const cartStorageKey = "jihc-canteen-cart";
const favoritesKey = "jihc-canteen-favorites";
const isFavoritesPage = location.pathname.endsWith("favorites.html");
const recommendations = document.querySelector("#recommendations");
const sort = document.querySelector("#sort");
let favoriteIds = [];
try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
    if (Array.isArray(saved)) favoriteIds = saved.filter(Number.isInteger);
} catch (error) { console.error("Could not restore favorites:", error); }

function toggleFavorite(id) {
    favoriteIds = favoriteIds.includes(id)
        ? favoriteIds.filter(function (value) { return value !== id; })
        : [...favoriteIds, id];
    try { localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds)); }
    catch (error) { console.error("Could not save favorites:", error); }
    showProducts();
}

function showConfirmation(orderId, purchased, amount) {
    const section = document.querySelector("#confirmation");
    section.hidden = false;
    document.querySelector("#confirmation-title").textContent =
        orderId ? "Order #" + orderId + " confirmed ✓" : "Order confirmed ✓";
    const list = document.querySelector("#confirmation-items");
    list.replaceChildren();
    for (const item of purchased) {
        const row = document.createElement("p");
        row.textContent = item.name + " × " + item.quantity + " — " + formatPrice(item.price * item.quantity) + " ₸";
        list.append(row);
    }
    document.querySelector("#confirmation-total").textContent = "Total: " + formatPrice(amount) + " ₸ · Collect at the canteen";
    section.scrollIntoView({ behavior: "smooth" });
}

const categoryNames = {
    chocolate: "Chocolate",
    juices: "Juices & Drinks",
    snacks: "Snacks",
    sandwiches: "Sandwiches"
};

const categoryEmoji = {
    chocolate: "🍫",
    juices: "🧃",
    snacks: "🍿",
    sandwiches: "🥪"
};

// В assets есть фото молочного шоколада. Для остальных блюд оставляем emoji.
const productImages = {
    "albeni": "albeni.png",
    "barni": "barni.webp",
    "bounty": "bounty.webp",
    "bruni": "bruni.jpeg",
    "kitkat": "kitkat.jpeg",
    "oreo": "oreo.jpeg",
    "ozera": "ozera.jpeg",
    "snickers": "snickers.jpeg"
};

// Общие данные товара из меню или сохранённой корзины.
function isValidProduct(item) {
    if (!item || !Number.isInteger(item.id) || item.id <= 0) {
        return false;
    }
    if (typeof item.name !== "string" || !item.name.trim()) {
        return false;
    }
    if (typeof item.price !== "number" && typeof item.price !== "string") {
        return false;
    }
    if (String(item.price).trim() === "") {
        return false;
    }
    const price = Number(item.price);
    return Number.isFinite(price) && price >= 0;
}

function findById(items, id) {
    for (const item of items) {
        if (item.id === id) {
            return item;
        }
    }
    return null;
}

function formatPrice(price) {
    return price.toLocaleString("ru-RU", {
        maximumFractionDigits: 2
    });
}

// Сохранение корзины.
function saveCart() {
    try {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch (error) {
        console.error("Could not save cart:", error);
    }
}

// Повреждённые записи пропускаем, остальные восстанавливаем.
function restoreCart() {
    cart = [];
    try {
        const savedCart = localStorage.getItem(cartStorageKey);
        if (!savedCart) {
            return;
        }

        const data = JSON.parse(savedCart);
        if (!Array.isArray(data)) {
            throw new Error("Invalid saved cart.");
        }

        for (const item of data) {
            if (!isValidProduct(item) || findById(cart, item.id)) {
                continue;
            }
            if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
                continue;
            }

            cart.push({
                id: item.id,
                name: item.name.trim(),
                price: Number(item.price),
                quantity: item.quantity
            });
        }
    } catch (error) {
        cart = [];
        console.error("Could not restore cart:", error);
    }
}

// Цены и названия берём с сервера, отсутствующие товары убираем.
function syncCartWithProducts() {
    const updatedCart = [];
    let hasChanges = false;

    for (const item of cart) {
        const product = findById(products, item.id);
        if (!product) {
            hasChanges = true;
            continue;
        }

        if (item.name !== product.name || item.price !== product.price) {
            item.name = product.name;
            item.price = product.price;
            hasChanges = true;
        }
        updatedCart.push(item);
    }

    cart = updatedCart;
    if (hasChanges) {
        saveCart();
        showCart();
        showOrderMessage(
            "Your cart was updated to match the current menu.",
            "success"
        );
    }
}

function createButton(text, label, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);

    return button;
}

function showMenuMessage(text) {
    const container = productsContainer || recommendations;
    if (!container) return;
    container.replaceChildren();
    const message = document.createElement("p");
    message.textContent = text;
    container.append(message);
}

// Общая проверка доступности кнопки заказа.
function updateOrderButton() {
    if (!orderButton) return;
    orderButton.disabled =
        cart.length === 0 ||
        isSubmitting ||
        menuState !== "ready";
}

// Отображение меню.
function showProducts() {
    // Во время загрузки и ошибки сохраняем сообщение и кнопку повтора.
    if (menuState !== "ready") {
        return;
    }
    const container = productsContainer || recommendations;
    if (!container) return;
    container.replaceChildren();
    const query = search ? search.value.trim().toLowerCase() : "";
    let displayed = products.slice();
    if (recommendations) displayed = displayed.filter(function (item) {
        return ["Chicken Sandwich", "Apple Juice", "Ozera"].includes(item.name);
    });
    if (isFavoritesPage) displayed = displayed.filter(function (item) { return favoriteIds.includes(item.id); });
    if (sort && sort.value === "low") displayed.sort(function (a, b) { return a.price - b.price; });
    if (sort && sort.value === "high") displayed.sort(function (a, b) { return b.price - a.price; });

    let visibleCount = 0;
    for (const product of displayed) {
        if (selectedCategory !== "all" && product.category !== selectedCategory) {
            continue;
        }
        if (!product.name.toLowerCase().includes(query)) {
            continue;
        }
        visibleCount += 1;

        const card = productTemplate.content
            .querySelector(".d1")
            .cloneNode(true);

        card.dataset.category = product.category;

        card.querySelector(".d3").textContent =
            categoryNames[product.category] || product.category;

        const productImage = productImages[product.name.toLowerCase()];
        const productIcon = card.querySelector(".d4");

        productIcon.textContent =
            categoryEmoji[product.category] || "🍽️";

        if (productImage) {
            const image = document.createElement("img");

            image.src = apiUrl + "/assets/" + productImage;
            image.alt = product.name;
            image.addEventListener("error", function () {
                image.replaceWith(productIcon);
            });

            productIcon.replaceWith(image);
        }

        card.querySelector(".d5 h3").textContent = product.name;
        card.querySelector(".d5 p").textContent =
            formatPrice(product.price) + " ₸";

        const addButton = card.querySelector(".d7");
        const orderNowButton = card.querySelector(".d8");

        addButton.disabled = isSubmitting;
        orderNowButton.disabled = isSubmitting;

        addButton.addEventListener("click", function () {
            addToCart(product.id);
            addButton.textContent = "Added ✓";
            const feedback = document.querySelector("#feedback");
            if (feedback) feedback.textContent = product.name + " added to Cart.";
        });

        orderNowButton.addEventListener("click", function () {
            if (isSubmitting) {
                return;
            }

            addToCart(product.id);

            location.href = "cart.html";
        });

        const heart = card.querySelector(".j1");
        const chosen = favoriteIds.includes(product.id);
        heart.textContent = chosen ? "♥" : "♡";
        heart.setAttribute("aria-pressed", String(chosen));
        heart.setAttribute("aria-label", (chosen ? "Remove " : "Save ") + product.name + " in favorites");
        heart.addEventListener("click", function () { toggleFavorite(product.id); });
        container.append(card);
    }

    if (visibleCount === 0) {
        const message = document.createElement("p");
        message.textContent = isFavoritesPage ? "No favorites yet. Save food with ♡ on Menu." : "No food found.";
        container.append(message);
    }
}

// Загрузка меню с сервера.
async function loadProducts() {
    if (isSubmitting || menuState === "loading") {
        return;
    }

    menuState = "loading";

    (productsContainer || recommendations)?.setAttribute("aria-busy", "true");
    updateOrderButton();
    showMenuMessage("Loading menu...");

    try {
        const response = await fetch(apiUrl + "/products");

        if (!response.ok) {
            throw new Error("Menu request failed: " + response.status);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Expected an array of products.");
        }

        const loadedProducts = [];
        for (const item of data) {
            if (!isValidProduct(item) || findById(loadedProducts, item.id)) {
                throw new Error("Invalid product data.");
            }
            if (typeof item.category !== "string" || !item.category.trim()) {
                throw new Error("Invalid product category.");
            }
            loadedProducts.push({
                id: item.id,
                name: item.name.trim(),
                price: Number(item.price),
                category: item.category.trim().toLowerCase()
            });
        }
        products = loadedProducts;

        menuState = "ready";
        syncCartWithProducts();
        showProducts();
    } catch (error) {
        products = [];
        menuState = "error";

        showMenuMessage("Could not load menu. Check the server and try again.");
        const retry = createButton("Try again", "Load menu again", loadProducts);
        retry.className = "d9";
        (productsContainer || recommendations)?.append(retry);

        // Сохранённая корзина остаётся при ошибке сервера.
        console.error("Menu error:", error);
    } finally {
        (productsContainer || recommendations)?.setAttribute("aria-busy", "false");
        const count = document.querySelector('[data-category="all"] span');
        if (count) count.textContent = products.length;
        updateOrderButton();
    }
}

// Добавление блюда.
function addToCart(productId) {
    if (isSubmitting || menuState !== "ready") {
        return;
    }

    const existingItem = findById(cart, productId);

    if (existingItem) {
        changeQuantity(productId, 1);
        return;
    } else {
        const product = findById(products, productId);

        if (!product) {
            return;
        }

        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    showOrderMessage("", "");
    updateCart();
}

// Изменение количества.
function changeQuantity(productId, change) {
    if (isSubmitting) {
        return;
    }

    const item = findById(cart, productId);

    if (!item) {
        return;
    }

    if (item.quantity + change > 100) {
        showOrderMessage(
            "Maximum quantity per product is 100.",
            "error"
        );
        return;
    }

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }

    showOrderMessage("", "");
    updateCart();
}

// Удаление блюда.
function removeFromCart(productId) {
    if (isSubmitting) {
        return;
    }

    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === productId) {
            cart.splice(i, 1);
            break;
        }
    }

    showOrderMessage("", "");
    updateCart();
}

// Отображение корзины.
function showCart() {
    cartCount.textContent = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    if (!cartItems) return;
    cartItems.replaceChildren();

    let totalCents = 0;
    let totalQuantity = 0;

    if (cart.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Your cart is empty.";
        cartItems.append(message);
    }

    for (const item of cart) {
        const row = document.createElement("div");
        row.className = "g2";

        const info = document.createElement("div");
        info.className = "g3";

        const name = document.createElement("h3");
        name.textContent = item.name;

        const price = document.createElement("p");
        price.textContent = formatPrice(item.price) + " ₸ each";

        info.append(name, price);

        const controls = document.createElement("div");
        controls.className = "g4";

        const minus = createButton(
            "−",
            "Decrease quantity of " + item.name,
            function () {
                changeQuantity(item.id, -1);
            }
        );

        const quantity = document.createElement("span");
        quantity.textContent = item.quantity;

        const plus = createButton(
            "+",
            "Increase quantity of " + item.name,
            function () {
                changeQuantity(item.id, 1);
            }
        );

        const remove = createButton(
            "Remove",
            "Remove " + item.name,
            function () {
                removeFromCart(item.id);
            }
        );

        minus.disabled = isSubmitting;
        plus.disabled = isSubmitting;
        remove.disabled = isSubmitting;
        remove.className = "g6";

        controls.append(minus, quantity, plus, remove);

        const itemCents =
            Math.round(item.price * 100) * item.quantity;

        const subtotal = document.createElement("strong");
        subtotal.className = "g5";
        subtotal.textContent = formatPrice(itemCents / 100) + " ₸";

        row.append(info, controls, subtotal);
        cartItems.append(row);

        totalCents += itemCents;
        totalQuantity += item.quantity;
    }

    total.textContent = formatPrice(totalCents / 100);
    cartCount.textContent = totalQuantity;
}

// Вызываем после изменения корзины, а не при блокировке формы.
function updateCart() {
    saveCart();
    showCart();
    updateOrderButton();
}

// Поиск.
searchForm?.addEventListener("submit", function (event) {
    event.preventDefault();
    showProducts();
});

search?.addEventListener("input", showProducts);

// Категории.
for (const button of categoryButtons) {
    button.addEventListener("click", function () {
        selectedCategory = button.dataset.category;

        for (const item of categoryButtons) {
            item.classList.toggle("c4", item === button);
        }

        showProducts();
    });
}

// Сообщения формы.
function showOrderMessage(text, type) {
    if (!orderMessage) return;
    orderMessage.textContent = text;
    orderMessage.className = "i4 " + type;
}

// Блокировка формы и корзины.
function setOrderBusy(busy) {
    isSubmitting = busy;
    customerName.disabled = busy;
    studentGroup.disabled = busy;

    if (busy) {
        orderButton.textContent = "Sending...";
    } else {
        orderButton.textContent = "Place Order";
    }
    orderForm.setAttribute("aria-busy", String(busy));

    // Меняем только доступность кнопок, без пересоздания карточек.
    const buttons = document.querySelectorAll("#products button, #cart-items button");
    for (const button of buttons) {
        button.disabled = busy;
    }
    updateOrderButton();
}

// Единственный обработчик отправки заказа.
orderForm?.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    if (menuState !== "ready") {
        showOrderMessage(
            "Wait for the menu to load before ordering.",
            "error"
        );
        return;
    }

    if (cart.length === 0) {
        showOrderMessage("Add food to your cart first.", "error");
        return;
    }

    const name = customerName.value.trim();
    const group = studentGroup.value.trim();

    if (!name || !group) {
        showOrderMessage("Enter your name and group.", "error");
        return;
    }

    if (name.length > 100 || group.length > 50) {
        showOrderMessage("Name or group is too long.", "error");
        return;
    }

    const items = [];
    for (const item of cart) {
        items.push({
            product_id: item.id,
            quantity: item.quantity
        });
    }

    const purchased = cart.map(function (item) { return { ...item }; });
    const amount = purchased.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
    showOrderMessage("", "");
    setOrderBusy(true);

    try {
        const response = await fetch(apiUrl + "/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                group: group,
                items: items
            })
        });

        // Ответ может прийти без JSON, например при ошибке сервера.
        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            console.error("Invalid order response:", error);
        }

        if (!response.ok) {
            let message = "Could not place your order.";
            if (data && typeof data.message === "string") {
                message = data.message;
            }

            showOrderMessage(message, "error");
            return;
        }

        showConfirmation(data?.order?.id, purchased, Number.isFinite(data?.total) ? data.total : amount);
        // Очищаем корзину только после успешного ответа.
        cart = [];
        saveCart();
        showCart();
        orderForm.reset();

        let message = "Your order was placed successfully!";
        if (data && data.order && data.order.id != null) {
            message = "Order #" + data.order.id + " placed successfully!";
        }
        showOrderMessage(message, "success");
    } catch (error) {
        console.error("Order error:", error);

        showOrderMessage(
            "Could not confirm your order. Your cart has been kept. " +
            "Check with the canteen before submitting again.",
            "error"
        );
    } finally {
        setOrderBusy(false);
    }
});

// Начальный запуск.
restoreCart();
showCart();
loadProducts();

sort?.addEventListener("change", showProducts);
