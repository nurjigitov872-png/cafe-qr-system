# Cafe QR System

React + Vite frontend, Express + MongoDB backend, админ панель, кардар менюсу, Socket.IO жана билдирүүлөр.

## Коопсуз локалдык иш

Негизги backend эски `backend/.env` файлын окубайт. Анын ичинде production маалыматтары болушу мүмкүн. Жеке файлдарды көчүрүп аралаштырбаңыз.

1. Толук обочолонгон UI/notification mock үчүн долбоордун түбүнөн `node backend/scripts/notification-preview.cjs` колдонсо болот. Ал базага, Telegram же реалдуу push'ка туташпайт. Заказ түзүү жабык; сервер RAM'дагы жасалма маалыматты гана берет. Аны интернетке чыгарбаңыз.
2. Заказ агымын local база менен текшерүү үчүн `backend/.env.example` үлгүсүн `backend/.env.local` файлына көчүрүңүз. Өзүнчө жергиликтүү MongoDB инстансы гана колдонулсун. Бул репозиторий база орнотпойт, ачпайт жана production маалыматтарын көчүрбөйт.
3. Жеке local админ сырсөзүн (кеминде 12 белги) жана random JWT ачкычын түзүңүз. JWT `local-` менен башталып, кеминде 32 белги болсун. Үлгүдөгү бош талааларды толтуруңуз; production сырларын колдонбоңуз.
4. PowerShell'де `$env:APP_ENV = 'local'` деп тандап, `npm --prefix backend run check:env` менен текшериңиз. Бул команда базага же тышкы кызматка туташпайт.
5. Текшерүү өтүп, жергиликтүү MongoDB коопсуз экени ырасталгандан кийин гана `npm --prefix backend run dev` иштетиңиз.
6. Frontend үчүн `frontend/.env.example` үлгүсүн `frontend/.env.development.local` файлына көчүрүңүз. `VITE_APP_ENV=local`, API/socket localhost:10000 менен дал келсин. Mock preview өзүнчө 10001/5174 портторун колдонот.
7. Кардар дареги: `http://localhost:5173/table/1`. Админге өзүңүздүн local маалыматтарыңыз менен кириңиз. Жалпы демейки сырсөз жок.

Shell environment файлдан жогору артыкчылыкта. Мурун экспорттолгон MONGO_URI/Telegram/VAPID маанилери болсо local текшерүү токтойт. Аларды жөн гана жашырып өткөрбөңүз; таза shell жана өзүнчө конфигурация колдонуңуз.

## Чөйрөлөр жана deployment

Backend `APP_ENV=local|staging|production` талап кылат; push-lab өзүнчө скрипт. Frontend `VITE_APP_ENV=local|staging|production|push-lab` колдонот. Production fallback жок.

Толук эрежелер: [backend чөйрөлөрү](docs/backend-environments.md), [frontend байланыш коргоосу](docs/connection-safety.md), [Android push-lab](docs/android-web-push-test.md).

Staging/production үчүн `backend/environment.remote.template` — бош үлгү гана. Чыныгы host, база, origins жана сырлар hosting администратору тарабынан ырасталсын. Render'де APP_ENV, NODE_ENV жана жаңы интеграция өчүргүчтөрү даяр болмоюнча deploy кылбаңыз. Frontend Vercel Preview — staging менен, Production — production менен дал келсин. Auto-deploy абалы hosting панелинен өзүнчө текшерилет.

## Тесттер

`npm --prefix backend test` жана `npm --prefix frontend test` mock жана обочолонгон тесттерди жүргүзөт. Backend тесттери жеке environment файлдарын окубайт жана реалдуу заказ түзбөйт. Онлайн төлөм provider'и азыр толук интеграцияланган эмес.
