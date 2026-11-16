# Backend чөйрөлөрүн коопсуз бөлүү

## Startup жана файлдар

APP_ENV shell/hosting ичинде local, staging же production болуп ачык берилет. Backend ошол мааниге жараша backend/.env.local, .env.staging же .env.production файлын гана окуйт. Эски backend/.env автоматтык окулбайт. Hosting'де файл жок болсо environment variables жетиштүү. Файлдагы APP_ENV shell тандоосуна каршы келсе токтойт; shell маанилери башка талааларда артыкчылыктуу.

Конфигурация толук текшерилмейинче process.env жаңырбайт, MongoDB/Telegram/Web Push модулдары импорттолбойт, DNS өзгөрбөйт жана порт ачылбайт. Startup катасы туруктуу текст менен гана чыгат. npm run check:env тармаксыз текшерет.

## Local

- NODE_ENV development же test болсун; production кабыл алынбайт.
- MONGO_URI так mongodb://127.0.0.1:27017/cafe_qr_local, localhost же [::1] түрүндө гана. Башка порт, SRV, credentials, query options, кошумча host же башка база аталышы четке кагылат.
- JWT_SECRET өзүнчө random ачкыч: local- префикси жана кеминде 32 белги. Админ сырсөзү кеминде 12 белги. Үлгүлөр сырларды камтыбайт.
- TELEGRAM_ENABLED=false, WEB_PUSH_ENABLED=false, PUSH_TEST_ENABLED=false. Telegram жана VAPID credentials талаалары бош/жок болсун. Алар өчүргүч false болсо да толтурулуп калса startup токтойт.
- MONGO_DNS_SERVERS жана remote Mongo pins берилбейт.
- CLIENT_URL/CORS_ORIGIN loopback гана; сервер 127.0.0.1 дарегине bind болот.
- Маалымат көчүрүлбөйт, база автоматтык provision кылынбайт. Өзүнчө local MongoDB'нин обочолонгон инстансы колдонулсун. Loopback порттун production'га tunnel/proxy эмес экенин оператор текшериши керек.

Толук тышкы байланышсыз UI текшерүү үчүн notification-preview.cjs бар: RAM моделдер, жасалма товар/заказ жана notification окуялары. Ал production базаны окубайт, жаңы заказ түзүүгө уруксат бербейт жана толук backend ордуна жүрбөйт. Интернетке чыгарууга болбойт.

## Staging жана production

NODE_ENV=production талап кылынат. MONGO_URI өзүнчө hosting конфигурациясынан берилет. MONGO_EXPECTED_HOST жана MONGO_EXPECTED_DATABASE URI менен так дал келсин. Staging базасынын аталышы _staging менен бүтөт. Бул pins production маанисин кокустан алмаштыруудан сактайт, бирок администратор эки мааниге тең туура эмес маалымат берсе аны тааный албайт. Staging DB колдонуучусунун production базага укугу болбосун.

CLIENT_URL/CORS_ORIGIN үчүн тиешелүү HTTPS frontend origin'дер гана кабыл алынат. Production'га localhost автоматтык кошулбайт. CORS толук authentication ордуна жүрбөйт.

TELEGRAM_ENABLED жана WEB_PUSH_ENABLED true/false болуп ачык берилсин. false болсо credentials жок болсун; true болсо толук credentials талап кылынат. Telegram/VAPID ачкычтары чөйрөлөр арасында бөлөк болушу керек; алардын кайсы аккаунтка тиешелүү экенин код өз алдынча биле албайт. Негизги remote backend'де PUSH_TEST_ENABLED=true четке кагылат.

JWT staging/local/push-lab үчүн issuer менен бөлүнөт; production issuer мурдагы бойдон сакталат. Ачкычтар өзүнчө random болсун. Local ачкыч remote чөйрөдө кабыл алынбайт. Токендердин мөөнөтү жана REST/Socket уруксаттары сакталат.

## Push-lab

push-lab.cjs негизги backend loader'ин колдонбойт. Ал APP_ENV=push-lab жана өзүнчө JWT коюп, RAM моделдерди гана колдонот. Реалдуу push үчүн мурдагыдай PUSH_LAB_ENABLE_REAL_PUSH=true жана HTTPS талап кылынат. Бул атайын lab уруксаты local backend'ге жайылбайт. Учурда реалдуу push аткарылган жок.

## Frontend жана hosting

Local frontend API localhost:10000/api, socket localhost:10000 болсун. CLIENT_URL ошол frontend origin менен дал келсин. Frontend staging/production да тиешелүү backend origin колдонот; байланыш коргоосу docs/connection-safety.md ичинде.

Жаңы кодду Render'ге deploy кылуудан мурун APP_ENV, NODE_ENV, Mongo pins, origins, credentials жана explicit интеграция flags даярдалсын. Болбосо сервер атайын иштебей токтойт. Vercel/Render auto-deploy өзүнчө текшерилсин. Бул иште hosting, жеке .env, MongoDB жана Telegram өзгөргөн жок.

## Чектөөлөр

APP_ENV менен pins инфраструктуранын identity далили эмес; туура эмес production маалыматтарын атайылап staging деп белгилөөнү код толук таба албайт. Loopback tunnel, DB permissions, dependency audit, заказдын сервердик баасын эсептөө жана login rate limit өзүнчө иштер. Тесттер реалдуу база же провайдерге кайрылбайт.
