import { Markup } from "telegraf";
import { buildCatalogKeyboard, buildMainKeyboard } from "./keyboards.js";
import { getCart, parseCartKey, getPriceByVolume } from "./utils.js";

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

  for (const [cartKey, quantity] of cart.entries()) {
    // Парсим ключ корзины: productId_volume
    const { productId, volume } = parseCartKey(cartKey);
    const prod = state.products.find((p) => String(p.id) === String(productId));

    if (prod) {
      // Получаем цену для конкретного объема
      const priceObj = getPriceByVolume(prod, volume);
      let price = 0;
      let priceText = "0";

      if (priceObj) {
        priceText = priceObj.price;
        price =
          parseFloat(
            String(priceText)
              .replace(/[^\d,.\-]/g, "")
              .replace(",", ".")
          ) || 0;
      } else if (prod.price) {
        // Fallback на старый формат
        priceText = prod.price;
        price =
          parseFloat(
            String(priceText)
              .replace(/[^\d,.\-]/g, "")
              .replace(",", ".")
          ) || 0;
      }

      const itemTotal = price * quantity;
      total += itemTotal;
      text += `${
        prod.title
      } (${volume})\nКоличество: ${quantity} × ${priceText} = ${itemTotal.toFixed(
        2
      )} ₸\n\n`;

      keyboard.push([
        Markup.button.callback(
          `✏️ ${prod.title} (${volume})`,
          `edit_cart_item_${cartKey}`
        ),
      ]);
    }
  }

  text += `💰 Итого: ${total.toFixed(2)} ₸`;
  keyboard.push([Markup.button.callback("✅ Оформить заказ", "checkout")]);
  keyboard.push([Markup.button.callback("🗑 Очистить корзину", "clear_cart")]);
  keyboard.push([
    Markup.button.callback("⬅️ Назад к категориям", "show_categories"),
  ]);
  try {
    await ctx.reply(text, Markup.inlineKeyboard(keyboard));
  } catch {
    await ctx.reply(text);
  }
}
