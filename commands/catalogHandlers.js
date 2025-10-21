import { Markup } from "telegraf";
import { buildCatalogKeyboard, buildMainKeyboard } from "./keyboards.js";
import { getCart } from "./utils.js";

export async function showCatalog(ctx, state, page = 1) {
  try {
    await ctx.reply(
      "Каталог товаров:",
      buildCatalogKeyboard(state.products, page)
    );
  } catch {
    await ctx.reply(
      "Каталог товаров:",
      buildCatalogKeyboard(state.products, page)
    );
  }
}

export async function showCart(ctx, state, userCarts) {
  const cart = getCart(userCarts, ctx.from.id);
  if (cart.size === 0) {
    try {
      await ctx.reply("🛒 Корзина пуста", buildMainKeyboard());
    } catch {
      await ctx.reply("🛒 Корзина пуста");
    }
    return;
  }
  let text = "🛒 Ваша корзина:\n\n";
  let total = 0;
  const keyboard = [];
  for (const [productId, quantity] of cart.entries()) {
    const prod = state.products.find((p) => String(p.id) === String(productId));
    if (prod) {
      const price =
        parseFloat(
          String(prod.price)
            .replace(/[^\d,.\-]/g, "")
            .replace(",", ".")
        ) || 0;
      const itemTotal = price * quantity;
      total += itemTotal;
      text += `${prod.title}\nКоличество: ${quantity} × ${
        prod.price || "0"
      } = ${itemTotal.toFixed(2)}\n\n`;
      keyboard.push([
        Markup.button.callback(
          `✏️ ${prod.title}`,
          `edit_cart_item_${productId}`
        ),
      ]);
    }
  }
  text += `💰 Итого: ${total.toFixed(2)}`;
  keyboard.push([Markup.button.callback("✅ Оформить заказ", "checkout")]);
  keyboard.push([Markup.button.callback("🗑 Очистить корзину", "clear_cart")]);
  keyboard.push([
    Markup.button.callback("⬅️ Вернуться в каталог", "catalog_back_1"),
  ]);
  try {
    await ctx.reply(text, Markup.inlineKeyboard(keyboard));
  } catch {
    await ctx.reply(text);
  }
}
