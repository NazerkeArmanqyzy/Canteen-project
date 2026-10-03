// Адрес сервера Айдины.
const apiUrl = "http://localhost:3000";

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
let menuState = "loading";
let isSubmitting = false;

const categoryNames = {
    chocolate: "Chocolate",
    juices: "Juices",
    snacks: "Snacks",
    sandwiches: "Sandwiches"
};

const categoryEmoji = {
    chocolate: "🍫",
    juices: "🧃",
    snacks: "🍿",
    sandwiches: "🥪"
};

function formatPrice(price) {
    return price.toLocaleString("ru-RU", {
        maximumFractionDigits: 2
    });
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
    const message = document.createElement("p");
    message.textContent = text;
    productsContainer.append(message);
}

// Отображение меню.
function showProducts() {
    productsContainer.replaceChildren();

    if (menuState === "loading") {
        showMenuMessage("Loading menu...");
        return;
    }

    if (menuState === "error") {
        showMenuMessage(
            "Could not load menu. Check the server and try again."
        );

        const retry = createButton(
            "Try again",
            "Load menu again",
            loadProducts
        );

        retry.className = "d9";
        retry.disabled = isSubmitting;
        productsContainer.append(retry);
        return;
    }

    const query = search.value.trim().toLowerCase();

    const filteredProducts = products.filter(function (product) {
        const matchesCategory =
            selectedCategory === "all" ||
            product.category === selectedCategory;

        const matchesSearch =
            product.name.toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
    });

    if (filteredProducts.length === 0) {
        showMenuMessage("No food found.");
        return;
    }

    filteredProducts.forEach(function (product) {
        const card = productTemplate.content
            .querySelector(".d1")
            .cloneNode(true);

        card.dataset.category = product.category;

        card.querySelector(".d3").textContent =
            categoryNames[product.category] || product.category;

        card.querySelector(".d4").textContent =
            categoryEmoji[product.category] || "🍽️";

        card.querySelector(".d5 h3").textContent = product.name;

        card.querySelector(".d5 p").textContent =
            formatPrice(product.price) + " ₸";

        const addButton = card.querySelector(".d7");
        const orderNowButton = card.querySelector(".d8");

        addButton.disabled = isSubmitting;
        orderNowButton.disabled = isSubmitting;

        addButton.addEventListener("click", function () {
            addToCart(product.id);
        });

        orderNowButton.addEventListener("click", function () {
            if (isSubmitting) return;

            addToCart(product.id);

            document.querySelector("#cart").scrollIntoView({
                behavior: "smooth"
            });
        });

        productsContainer.append(card);
    });
}

// Загрузка блюд из PostgreSQL через сервер.
async function loadProducts() {
    if (isSubmitting) return;

    menuState = "loading";
    productsContainer.setAttribute("aria-busy", "true");
    showProducts();

    try {
        const response = await fetch(apiUrl + "/products");

        if (!response.ok) {
            throw new Error("Menu request failed: " + response.status);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Expected an array of products.");
        }

        const ids = new Set();

        products = data.map(function (product) {
            if (!product || typeof product !== "object") {
                throw new Error("Invalid product data.");
            }

            const id = Number(product.id);
            const price = Number(product.price);

            if (
                !Number.isInteger(id) ||
                id <= 0 ||
                id > 2147483647 ||
                typeof product.name !== "string" ||
                !product.name.trim() ||
                typeof product.category !== "string" ||
                !product.category.trim() ||
                product.price == null ||
                product.price === "" ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                throw new Error("Invalid product data.");
            }

            if (ids.has(id)) {
                throw new Error("Duplicate product ID.");
            }

            ids.add(id);

            return {
                id: id,
                name: product.name.trim(),
                price: price,
                category: product.category.toLowerCase().trim()
            };
        });

        document.querySelector(
            '[data-category="all"] span'
        ).textContent = products.length;

        menuState = "ready";
    } catch (error) {
        products = [];
        menuState = "error";

        document.querySelector(
            '[data-category="all"] span'
        ).textContent = "0";

        console.error("Menu error:", error);
    } finally {
        productsContainer.setAttribute("aria-busy", "false");
        showProducts();
    }
}

// Добавление в корзину.
function addToCart(productId) {
    if (isSubmitting) return;

    const existingItem = cart.find(function (item) {
        return item.id === productId;
    });

    if (existingItem) {
        if (existingItem.quantity >= 100) {
            showOrderMessage(
                "Maximum quantity per product is 100.",
                "error"
            );
            return;
        }

        existingItem.quantity += 1;
    } else {
        const product = products.find(function (item) {
            return item.id === productId;
        });

        if (!product) return;

        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    showOrderMessage("", "");
    showCart();
}

// Изменение количества.
function changeQuantity(productId, change) {
    if (isSubmitting) return;

    const item = cart.find(function (product) {
        return product.id === productId;
    });

    if (!item) return;

    if (item.quantity + change > 100) {
        showOrderMessage(
            "Maximum quantity per product is 100.",
            "error"
        );
        return;
    }

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(function (product) {
            return product.id !== productId;
        });
    }

    showOrderMessage("", "");
    showCart();
}

// Удаление блюда.
function removeFromCart(productId) {
    if (isSubmitting) return;

    cart = cart.filter(function (item) {
        return item.id !== productId;
    });

    showOrderMessage("", "");
    showCart();
}

// Отображение корзины.
function showCart() {
    cartItems.replaceChildren();

    let totalCents = 0;
    let totalQuantity = 0;

    if (cart.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Your cart is empty.";
        cartItems.append(message);
    }

    cart.forEach(function (item) {
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
        subtotal.textContent =
            formatPrice(itemCents / 100) + " ₸";

        row.append(info, controls, subtotal);
        cartItems.append(row);

        totalCents += itemCents;
        totalQuantity += item.quantity;
    });

    total.textContent = formatPrice(totalCents / 100);
    cartCount.textContent = totalQuantity;
}

// Поиск.
searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showProducts();
});

search.addEventListener("input", showProducts);

// Категории.
categoryButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        selectedCategory = button.dataset.category;

        categoryButtons.forEach(function (item) {
            item.classList.toggle("c4", item === button);
        });

        showProducts();
    });
});

// Сообщение о заказе.
function showOrderMessage(text, type) {
    orderMessage.textContent = text;
    orderMessage.className = "i4 " + type;
}

// Блокировка формы и корзины во время отправки.
function setOrderBusy(busy) {
    orderButton.disabled = busy;
    customerName.disabled = busy;
    studentGroup.disabled = busy;

    orderButton.textContent = busy
        ? "Sending..."
        : "Place Order";

    orderForm.setAttribute("aria-busy", String(busy));

    showProducts();
    showCart();
}

// Отправка заказа.
orderForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isSubmitting) return;

    if (cart.length === 0) {
        showOrderMessage(
            "Add food to your cart first.",
            "error"
        );
        return;
    }

    const name = customerName.value.trim();
    const group = studentGroup.value.trim();

    if (!name || !group) {
        showOrderMessage(
            "Enter your name and group.",
            "error"
        );
        return;
    }

    if (name.length > 100 || group.length > 50) {
        showOrderMessage(
            "Name or group is too long.",
            "error"
        );
        return;
    }

    const items = cart.map(function (item) {
        return {
            product_id: item.id,
            quantity: item.quantity
        };
    });

    isSubmitting = true;
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

        const data = await response.json().catch(function () {
            return null;
        });

        if (!response.ok) {
            const message =
                data && typeof data.message === "string"
                    ? data.message
                    : "Could not place your order.";

            showOrderMessage(message, "error");
            return;
        }

        // Успешный ответ сервера — очищаем корзину.
        cart = [];
        orderForm.reset();

        const orderId = data?.order?.id;

        showOrderMessage(
            orderId != null
                ? "Order #" + orderId + " placed successfully!"
                : "Your order was placed successfully!",
            "success"
        );
    } catch (error) {
        console.error("Order error:", error);

        showOrderMessage(
            "Could not confirm your order. Your cart has been kept. " +
            "Check with the canteen before submitting again.",
            "error"
        );
    } finally {
        isSubmitting = false;
        setOrderBusy(false);
    }
});

showCart();
loadProducts();