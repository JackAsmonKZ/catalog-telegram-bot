# Telegram Bot

> Приватный репозиторий: JackAsmonKZ/telegram-bot  
> Язык: JavaScript

## Быстрый старт

1. Склонировать репозиторий:
   git clone https://github.com/JackAsmonKZ/telegram-bot.git
2. Установить зависимости:
   cd telegram-bot
   npm install
3. Создать .env файл с переменными (пример ниже).
4. Запустить бота:
   npm start

## Требования

- Node.js >= 16 (или версия, которую ты используешь)
- npm или yarn
- Токен бота от BotFather (TELEGRAM_BOT_TOKEN)
- (Опционально) База данных (MongoDB, Postgres и т.п.) — если проект использует хранение

## Переменные окружения (пример .env)

BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
ADMIN_ID=mongodb://localhost:27017/mybot

Создай `.env` в корне и подставь свои значения.

## Установка и запуск

- Установка зависимостей:
  npm install

- Локальный запуск (long polling):
  npm run start

- Запуск в режиме разработки (с перезагрузкой):
  npm run dev

(Добавь скрипты в package.json, если их нет)
Пример:
{
  "name": "tg-catalog-bot",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "dotenv": "^17.2.3",
    "fs-extra": "^11.1.1",
    "telegraf": "^4.12.2"
  },
  "scripts": {
    "start": "node index.js"
  }
}


## Контакты / Автор

JackAsmonKZ — владелец репозитория  
@jackasmon - tg
