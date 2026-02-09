# Docker Compose Setup для Accounting System

## Структура контейнерів

Проект розділено на 2 окремих контейнери:

1. **app** - Node.js Express додаток (порт 3308)
2. **db** - MySQL 8.0 база даних (порт 3306)

## Передумови

- Docker (v20+)
- Docker Compose (v2+)

## Встановлення та запуск

### 1. Клонування проекту

```bash
git clone https://github.com/M1R4MI/Accounting-System-for-Internship.git
cd Accounting-System-for-Internship
```

### 2. Запуск контейнерів

```bash
docker-compose up -d
```

Флаг `-d` запускає контейнери у фоні.

### 3. Перевірка статусу

```bash
docker-compose ps
```

Ви повинні бачити обидва контейнери (`accounting-app` та `accounting-db`) зі статусом "Up".

### 4. Доступ до додатку

Додаток буде доступний за адресою: **http://localhost:3308**

## Команди для управління

### Перегляд логів

```bash
# Логи всіх сервісів
docker-compose logs -f

# Логи конкретного сервісу
docker-compose logs -f app
docker-compose logs -f db
```

### Зупинка контейнерів

```bash
docker-compose down
```

Цей процес зупинить контейнери, але збереже дані в базі даних (завдяки Docker volumes).

### Видалення всього, включно з даними

```bash
docker-compose down -v
```

Флаг `-v` також видалить усі volumes (включно з даними БД).

### Перезапуск

```bash
docker-compose restart
```

## Конфігурація

Змінні оточення визначені у файлі `.env`:

```env
# MySQL Configuration
DB_HOST=db
DB_PORT=3306
DB_NAME=AccountingSystem
DB_USER=accounting_user
DB_PASSWORD=rootmaster123
DB_USER_PASSWORD=app_password_123

# Application
APP_PORT=3308
```

## Структура файлів

```
.
├── Dockerfile              # Контейнер для Node.js додатку
├── docker-compose.yml      # Конфігурація контейнерів
├── .env                    # Змінні оточення
├── .dockerignore           # Файли для ігнорування при збірці
├── init.sql                # SQL скрипти для ініціалізації БД
├── package.json            # Залежності Node.js
├── JS/
│   ├── server.js
│   ├── db.js              # Оновлено для використання env змінних
│   └── ...
├── public/
│   ├── html/
│   ├── css/
│   └── ...
└── uploads/               # Зберігання завантажень (bind mount)
```

## Постійність даних

- Дані MySQL зберігаються у Docker volume `db_data`
- Завантажены файли зберігаються у локальній папці `uploads/`

Ці дані залишаються навіть після виконання `docker-compose down`.

## Розв'язання проблем

### Портовий конфлікт

Якщо порти 3308 або 3306 вже використовуються:

1. Змініть портів у `.env`:
   ```env
   APP_PORT=3309
   DB_PORT=3307
   ```

2. Перезапустіть контейнери:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### БД не інічіалізується

Якщо таблиці не створюються при першому запуску:

```bash
# Видаліть volume з даними
docker-compose down -v

# Перезапустіть
docker-compose up -d

# Перевірте логи БД
docker-compose logs db
```

### Додаток не може підключитися до БД

```bash
# Перевірте логи додатку
docker-compose logs app

# Перевірте, чи БД готова до роботи
docker-compose logs db
```

## Розробка

Для розробки ви можете змінити `docker-compose.yml`, додавши volume для код:

```yaml
app:
  volumes:
    - .:/app
    - /app/node_modules
```

Це дозволить вам редагувати код без перезбірки контейнера.

## Продакшн розгортання

Для продакшену розгляньте використання:
- Зберіганнями для密码у secrets (не у .env)
- Nginx для реверс-проксування
- Backup стратегій для БД
