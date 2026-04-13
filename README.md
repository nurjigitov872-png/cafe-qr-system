# Cafe QR System Clean

Бул архив таза, кайрадан жасалган жана бир папка менен иштетүүгө ыңгайлуу версия.

## Эмне бар
- React + Vite frontend
- Node.js + Express backend
- MongoDB
- Admin login
- Menu / Orders / Dashboard / Kitchen / Waiter / Tables QR
- Socket.IO realtime
- Customer order tracking
- Demo online payment flow
- Telegram hook каркасы

## Иштетүү

### 1) Backend
```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run seed
npm run dev
```

### 2) Frontend
```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

## Admin
- username: `admin`
- password: `admin12345`

## Кардар
- `http://localhost:5173/table/1`

## Эскертүү
Реал payment provider кошуу үчүн merchant credential керек.
