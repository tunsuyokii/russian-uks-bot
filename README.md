# Задания по русскому языку

Веб-приложение для решения заданий по русскому языку: загрузите скриншот задания (например, из приложения «Ножницы») — получите ответ и краткое пояснение.

## Как пользоваться

1. Откройте [страницу приложения](https://tunsuyokii.github.io/russian-uks-bot/) (после деплоя).
2. **Вставьте изображение** с заданием:
   - нажмите **Ctrl+V** (или Cmd+V на Mac), если картинка уже в буфере (например, после «Ножниц»);
   - или перетащите файл в область загрузки;
   - или нажмите на область и выберите файл.
3. Нажмите **«Решить задание»**.
4. В блоке ниже появятся **ответ** и **краткое пояснение**.

## Технологии

- Фронтенд: HTML, CSS, JavaScript (статическая вёрстка).
- API: [ProxyAPI](https://proxyapi.ru/docs/overview) — анализ изображения (модель с поддержкой зрения) и проверка ответа (GPT 5.2 с fallback на gpt-4o).

## Деплой на GitHub Pages

Репозиторий: [tunsuyokii/russian-uks-bot](https://github.com/tunsuyokii/russian-uks-bot).

### Вариант 1: через GitHub Actions (рекомендуется)

1. Залейте код в репозиторий:
   ```bash
   git init
   git remote add origin https://github.com/tunsuyokii/russian-uks-bot.git
   git add .
   git commit -m "Initial: задания по русскому языку"
   git branch -M main
   git push -u origin main
   ```
2. В GitHub: **Settings → Pages**.
3. В блоке **Build and deployment**:
   - **Source**: GitHub Actions.
4. После успешного запуска workflow **Deploy to GitHub Pages** сайт будет доступен по адресу:
   `https://tunsuyokii.github.io/russian-uks-bot/`

### Вариант 2: деплой из ветки

1. Залейте код в репозиторий (как выше).
2. **Settings → Pages**:
   - **Source**: Deploy from a branch.
   - **Branch**: main, папка **/ (root)**.
3. Сохраните. Через пару минут сайт откроется по тому же URL.

## Важно

- API-ключ ProxyAPI сейчас задаётся в коде фронтенда (`app.js`). В открытом репозитории он виден всем. Для реального использования лучше вынести запросы к API на свой backend и хранить ключ только на сервере.
