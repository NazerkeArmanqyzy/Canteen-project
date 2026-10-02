const productsContainer = document.querySelector("#products");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const total = document.querySelector("#total");
const search = document.querySelector("#search");
const searchForm = document.querySelector(".b1");
const categoryButtons = document.querySelectorAll(".c3");

let products = [];
let cart = [];
let selectedCategory = "all";

// Уточни у Айдины адрес сервера.
// Здесь предполагается, что сервер работает на порту 3000.
const productsUrl = "http://localhost:3000/products";

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

// Используем твою карточку как шаблон:
// классы и оформление остаются прежними.
const cardTemplate = productsContainer
    .querySelector(".d1")
    .cloneNode(true);

function formatPrice(price) {
    return price.toLocaleString("ru-RU");
}

// Показываем блюда с учётом поиска и категории.
function showProducts() {
    productsContainer.replaceChildren();

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
        const message = document.createElement("p");
        message.textContent = "No food found.";
        productsContainer.append(message);
        return;
    }

    filteredProducts.forEach(function (product) {
        const card = cardTemplate.cloneNode(true);

        card.dataset.category = product.category;

        card.querySelector(".d3").textContent =
            categoryNames[product.category] || product.category;

        card.querySelector(".d4").textContent =
            categoryEmoji[product.category] || "🍽️";

        card.querySelector(".d5 h3").textContent = product.name;

        card.querySelector(".d5 p").textContent =
            formatPrice(product.price) + " ₸";

        card.querySelector(".d7").addEventListener("click", function () {
            addToCart(product.id);
        });

        card.querySelector(".d8").addEventListener("click", function () {
            addToCart(product.id);

            document.querySelector("#cart").scrollIntoView({
                behavior: "smooth"
            });
        });

        productsContainer.append(card);
    });
}

// Добавление блюда в корзину.
function addToCart(productId) {
    const existingItem = cart.find(function (item) {
        return item.id === productId;
    });

    if (existingItem) {
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

    showCart();
}

// Изменение количества.
// Если количество становится нулём, убираем блюдо.
function changeQuantity(productId, change) {
    const item = cart.find(function (product) {
        return product.id === productId;
    });

    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(function (product) {
            return product.id !== productId;
        });
    }

    showCart();
}

function removeFromCart(productId) {
    cart = cart.filter(function (item) {
        return item.id !== productId;
    });

    showCart();
}

function createButton(text, label, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);

    return button;
}

// Обновление корзины, суммы и счётчика.
function showCart() {
    cartItems.replaceChildren();

    let totalPrice = 0;
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
        remove.className = "g6";

        controls.append(minus, quantity, plus, remove);

        const subtotal = document.createElement("strong");
        subtotal.className = "g5";
        subtotal.textContent =
            formatPrice(item.price * item.quantity) + " ₸";

        row.append(info, controls, subtotal);
        cartItems.append(row);

        totalPrice += item.price * item.quantity;
        totalQuantity += item.quantity;
    });

    total.textContent = formatPrice(totalPrice);
    cartCount.textContent = totalQuantity;
}

// Поиск.
searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showProducts();
});

search.addEventListener("input", showProducts);

// Переключение категорий.
categoryButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        categoryButtons.forEach(function (item) {
            item.classList.remove("c4");
        });

        button.classList.add("c4");
        selectedCategory = button.dataset.category;

        showProducts();
    });
});

// Загрузка меню с сервера.
async function loadProducts() {
    productsContainer.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Loading menu...";
    productsContainer.append(message);

    try {
        const response = await fetch(productsUrl);

        if (!response.ok) {
            throw new Error("Menu request failed: " + response.status);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Expected an array of products");
        }

        const ids = new Set();

        products = data.map(function (product) {
            const price = Number(product.price);

            if (
                product.id == null ||
                typeof product.name !== "string" ||
                typeof product.category !== "string" ||
                product.price == null ||
                product.price === "" ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                throw new Error("Invalid product data");
            }

            const id = String(product.id);

            if (ids.has(id)) {
                throw new Error("Duplicate product ID");
            }

            ids.add(id);

            return {
                id: id,
                name: product.name,
                price: price,
                category: product.category.toLowerCase().trim()
            };
        });

        const allFoodCount = document.querySelector(
            '[data-category="all"] span'
        );

        allFoodCount.textContent = products.length;

        showProducts();
    } catch (error) {
        products = [];
        productsContainer.replaceChildren();

        const errorMessage = document.createElement("p");
        errorMessage.textContent =
            "Could not load menu. Check the server and try again.";

        const retry = createButton(
            "Try again",
            "Load menu again",
            loadProducts
        );
        retry.className = "d7";

        productsContainer.append(errorMessage, retry);
        console.error(error);
    }
}

showCart();
loadProducts();