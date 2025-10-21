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

export function buildCatalogKeyboard(products, page) {
  const p = Math.max(1, Math.min(page, pageCount(products)));
  const items = getPage(products, p).map((prod) => [
    Markup.button.callback(
      `${prod.title} — ${prod.price || ""}`,
      `product_${prod.id}_p${p}`
    ),
  ]);
  const controls = [];
  if (p > 1) controls.push(Markup.button.callback("⬅️ Назад", `page_${p - 1}`));
  if (p < pageCount(products))
    controls.push(Markup.button.callback("Вперёд ➡️", `page_${p + 1}`));
  const keyboard = [...items];
  if (controls.length) keyboard.push(controls);
  keyboard.push([Markup.button.callback("🔍 Поиск", "search")]);
  keyboard.push([Markup.button.callback("🛒 Корзина", "view_cart")]);
  return Markup.inlineKeyboard(keyboard);
}

export function buildMainKeyboard() {
  return Markup.keyboard([["📦 Каталог", "🛒 Корзина"]]).resize();
}

export function getProductKeyboard(productId, page, cart, source = "catalog") {
  const quantity = cart.get(productId) || 0;
  const keyboard = [];
  if (quantity === 0) {
    keyboard.push([
      Markup.button.callback(
        "➕ Добавить в корзину",
        `add_to_cart_${productId}_${page}_${source}`
      ),
    ]);
  } else {
    keyboard.push([
      Markup.button.callback("-", `cart_dec_${productId}_${page}_${source}`),
      Markup.button.callback(`${quantity}`, `cart_noop`),
      Markup.button.callback("+", `cart_inc_${productId}_${page}_${source}`),
    ]);
    keyboard.push([
      Markup.button.callback(
        "🗑 Удалить из корзины",
        `remove_from_cart_${productId}_${page}_${source}`
      ),
    ]);
  }
  keyboard.push([Markup.button.callback("🛒 Перейти в корзину", "view_cart")]);
  if (source === "catalog") {
    keyboard.push([
      Markup.button.callback("⬅️ Назад в каталог", `catalog_back_${page}`),
    ]);
  } else if (source === "search") {
    keyboard.push([
      Markup.button.callback("⬅️ Назад к результатам", "back_to_search"),
      Markup.button.callback("⬅️ В каталог", "catalog_back_1"),
    ]);
  }
  return Markup.inlineKeyboard(keyboard);
}
