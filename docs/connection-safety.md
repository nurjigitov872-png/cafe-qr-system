# API жана Socket.IO чөйрөлөрү

Frontend байланыштары src/config/connections.js аркылуу текшерилет. Production fallback жок. Конфигурация жетишпесе Vite dev/build жана браузер импорттоодо токтойт; fetch/socket башталбайт. HTTP API redirect кабыл алынбайт.

## Local

VITE_APP_ENV=local, VITE_API_URL=http://localhost:10000/api. Socket URL берилбесе API origin колдонулат; берилсе дал келиши керек. Development режиминде local жана loopback гана уруксат. Mock preview 10001/5174 портторун колдонот жана Vite configFile:false болсо да браузер саясаты колдонулат.

Жеке файлды .env.development.local катары сактаңыз. Frontend'дин учурдагы .env файлы да Vite тарабынан окулат; shell environment артыкчылыктуу. Негизги backend үчүн APP_ENV=local жана backend/.env.local колдонулат. Ал эски backend/.env файлын окубайт. Localhost backend өзүнөн өзү коопсуз база дегенди билдирбейт: [backend эрежелерин](backend-environments.md) сактаңыз.

## Staging жана production

VITE_APP_ENV тиешелүү staging же production болсун. VITE_API_URL, VITE_BACKEND_ORIGIN жана VITE_FRONTEND_ORIGIN үчүн аккаунт ээсинен ырасталган HTTPS даректер талап кылынат. Backend origin API origin менен, браузер origin frontend origin менен дал келет. Wildcard жок. VITE_* коомдук bundle ичинде көрүнөт: сырларды жазбаңыз.

Vercel Preview үчүн өзүнчө staging backend/база жана Production үчүн production маанилерин коюңуз. Preview URL так frontend origin катары build учурунда берилсин. Ар бир environment өзгөрүүсүнө rebuild керек. Vercel SPA rewrite өзгөрбөйт. Render CORS тиешелүү frontend менен чектелет; жаңы backend production'га localhost'ту автоматтык кошпойт. CORS сервердик уруксат текшерүүнү алмаштырбайт.

Белгилер өз алдынча production identity далили эмес: ырасталган origin маанилерин туура берүү hosting администраторунун милдети. Auto-deploy жана staging/production database бөлүнүшү hosting ичинде өзүнчө текшерилет.

## Push-lab

VITE_APP_ENV=push-lab; API, socket жана VITE_BACKEND_ORIGIN бир lab HTTPS origin колдонсун, VITE_FRONTEND_ORIGIN да ошол origin болсун. Бул dev server эмес, өзүнчө build. Негизги backend/.env колдонулбайт. Реалдуу push демейки өчүк. Android нускамасын караңыз.

## Текшерүү

npm --prefix frontend test жана npm --prefix backend test. Конфигурация тесттери эч бир базага же Telegram кызматына кайрылбайт. Build үчүн shell аркылуу local mock origin бериңиз; бул backend баштабайт. npm run preview да браузерде origin саясатын сактайт.
