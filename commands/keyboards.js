import { Markup } from "telegraf";

const PAGE_SIZE = 5;

function pageCount(products) {
  return Math.max(1, Math.ceil(products.length / PAGE_SIZE));
}

function getPage(products, page) {
  const p = Math.max(1, Math.min(page, pageCount(products)));
  const start = (p - 1) * PAGE_SIZE;
  return products.slice(start, start + PAGE_SIZE);
}

// Клавиатура для выбора объема товара
export function buildVolumeSelectionKeyboard(
  product,
  page,
  source = "catalog",
  categoryId = null
) {
  const keyboard = [];

  // Проверяем, есть ли массив цен
  if (
    !product.prices ||
    !Array.isArray(product.prices) ||
    product.prices.length === 0
  ) {
    // Если нет prices, показываем сообщение об ошибке
    keyboard.push([
      Markup.button.callback("⚠️ Цены не указаны", "error_no_prices"),
    ]);
  } else {
    // Добавляем кнопки для каждого объема
    product.prices.forEach((priceObj) => {
      keyboard.push([
        Markup.button.callback(
          `${priceObj.volume} — ${priceObj.price}`,
          `select_volume_${product.id}_${priceObj.volume}_${page}_${source}_${
            categoryId || "none"
          }`
        ),
      ]);
    });
  }

  // Кнопка корзины
  keyboard.push([Markup.button.callback("🛒 Перейти в корзину", "view_cart")]);

  // Кнопки возврата
  if (source === "catalog") {
    if (categoryId && categoryId !== "none") {
      keyboard.push([
        Markup.button.callback(
          "⬅️ Назад к категории",
          `category_back_${categoryId}_${page}`
        ),
        Markup.button.callback("⬅️ Все категории", "show_categories"),
      ]);
    } else {
      keyboard.push([
        Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
      ]);
    }
  } else if (source === "search") {
    keyboard.push([
      Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
    ]);
  }

  return Markup.inlineKeyboard(keyboard);
}

export function buildCatalogKeyboard(products, page, categoryId = null) {
  const p = Math.max(1, Math.min(page, pageCount(products)));
  const items = getPage(products, p).map((prod) => {
    let priceText = "";
    if (prod.prices && Array.isArray(prod.prices) && prod.prices.length > 0) {
      if (prod.prices.length === 1) {
        priceText = prod.prices[0].price;
      } else {
        // Показываем "от минимальной цены"
        priceText = `от ${prod.prices[0].price}`;
      }
    } else if (prod.price) {
      // Поддержка старого формата
      priceText = prod.price;
    }
    return [
      Markup.button.callback(
        `${prod.title}${priceText ? ` — ${priceText}` : ""}`,
        `product_${prod.id}_p${p}`
      ),
    ];
  });
  const controls = [];
  if (p > 1) controls.push(Markup.button.callback("⬅️ Назад", `page_${p - 1}`));
  if (p < pageCount(products))
    controls.push(Markup.button.callback("Вперёд ➡️", `page_${p + 1}`));
  const keyboard = [...items];
  if (controls.length) keyboard.push(controls);

  // Добавляем кнопку "Назад к категориям" если мы внутри категории
  if (categoryId) {
    keyboard.push([
      Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
    ]);
  }

  return Markup.inlineKeyboard(keyboard);
}

export function buildMainKeyboard() {
  return Markup.keyboard([["📦 Каталог", "🛒 Корзина", "🔍 Поиск"]]).resize();
}

// Клавиатура с категориями
export function buildCategoriesKeyboard(categories, products, page = 1) {
  const CATEGORIES_PER_PAGE = 5;
  const keyboard = [];

  // Создаем массив всех категорий с товарами
  const allCategories = [];

  categories.forEach((category) => {
    const productCount = products.filter(
      (p) => String(p.category) === String(category.id)
    ).length;
    if (productCount > 0) {
      allCategories.push({
        name: category.name,
        id: category.id,
        count: productCount,
      });
    }
  });

  // Добавляем "Без категории" если есть товары
  const uncategorizedCount = products.filter((p) => {
    if (!p.category) return true;
    return !categories.find((c) => String(c.id) === String(p.category));
  }).length;

  if (uncategorizedCount > 0) {
    allCategories.push({
      name: "Без категории",
      id: "uncategorized",
      count: uncategorizedCount,
    });
  }

  // Вычисляем пагинацию
  const totalPages = Math.max(
    1,
    Math.ceil(allCategories.length / CATEGORIES_PER_PAGE)
  );
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * CATEGORIES_PER_PAGE;
  const endIndex = startIndex + CATEGORIES_PER_PAGE;

  // Показываем категории для текущей страницы
  const pageCategories = allCategories.slice(startIndex, endIndex);

  pageCategories.forEach((category) => {
    keyboard.push([
      Markup.button.callback(
        `${category.name} (${category.count})`,
        `category_${category.id}`
      ),
    ]);
  });

  // Добавляем навигацию если нужно
  const navigation = [];
  if (currentPage > 1) {
    navigation.push(
      Markup.button.callback("⬅️ Назад", `categories_page_${currentPage - 1}`)
    );
  }
  if (currentPage < totalPages) {
    navigation.push(
      Markup.button.callback("Вперёд ➡️", `categories_page_${currentPage + 1}`)
    );
  }
  if (navigation.length > 0) {
    keyboard.push(navigation);
  }

  return Markup.inlineKeyboard(keyboard);
}

export function getProductKeyboard(
  productId,
  page,
  cart,
  source = "catalog",
  categoryId = null,
  selectedVolume = null
) {
  const keyboard = [];

  // Если объем выбран, показываем кнопки управления корзиной
  if (selectedVolume) {
    const cartKey = `${productId}_${selectedVolume}`;
    const quantity = cart.get(cartKey) || 0;

    if (quantity === 0) {
      keyboard.push([
        Markup.button.callback(
          "➕ Добавить в корзину",
          `add_to_cart_${productId}_${selectedVolume}_${page}_${source}_${
            categoryId || "none"
          }`
        ),
      ]);
    } else {
      keyboard.push([
        Markup.button.callback(
          "-",
          `cart_dec_${productId}_${selectedVolume}_${page}_${source}_${
            categoryId || "none"
          }`
        ),
        Markup.button.callback(`${quantity}`, `cart_noop`),
        Markup.button.callback(
          "+",
          `cart_inc_${productId}_${selectedVolume}_${page}_${source}_${
            categoryId || "none"
          }`
        ),
      ]);
      keyboard.push([
        Markup.button.callback(
          "🗑 Удалить из корзины",
          `remove_from_cart_${productId}_${selectedVolume}_${page}_${source}_${
            categoryId || "none"
          }`
        ),
      ]);
    }

    // Кнопка "Выбрать другой объем"
    keyboard.push([
      Markup.button.callback(
        "↩️ Выбрать другой объем",
        `product_${productId}_p${page}`
      ),
    ]);
  }

  keyboard.push([Markup.button.callback("🛒 Перейти в корзину", "view_cart")]);
  if (source === "catalog") {
    if (categoryId && categoryId !== "none") {
      // Если есть категория - показываем кнопку возврата к ней
      keyboard.push([
        Markup.button.callback(
          "⬅️ Назад к категории",
          `category_back_${categoryId}_${page}`
        ),
        Markup.button.callback("⬅️ Все категории", "show_categories"),
      ]);
    } else {
      // Если категории нет - просто показываем кнопку к категориям
      keyboard.push([
        Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
      ]);
    }
  } else if (source === "search") {
    keyboard.push([
      Markup.button.callback("⬅️ Назад к результатам", "back_to_search"),
      Markup.button.callback("⬅️ Категории", "show_categories"),
    ]);
  }
  return Markup.inlineKeyboard(keyboard);
}
