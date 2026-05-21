# PawAdopt — Server

A production-ready REST API for the PawAdopt platform, built with Node.js, Express 5, MongoDB, and JWT authentication stored in HTTPOnly cookies.

## Live URL

**[https://pawadopt-server.onrender.com](https://pawadopt-server.onrender.com)**

## Features

- JWT authentication stored in HTTPOnly cookies — secure and XSS-resistant
- Owner-only controls: only the listing owner can update, delete, approve, or reject
- Adoption guards: owners cannot adopt their own pets; only one request can be approved per pet
- Pet search with `$regex`, species filter with `$in`, and multi-field sorting
- Auto-reject all other pending requests when one is approved
- Cascading delete — removing a pet also clears all its adoption requests
- MongoDB Atlas with DNS override for reliable cloud connectivity

## Tech Stack

| Package | Purpose |
|---|---|
| `express` | Web framework |
| `mongodb` | Native MongoDB driver |
| `jsonwebtoken` | JWT token generation and verification |
| `cookie-parser` | HTTPOnly cookie parsing |
| `cors` | Cross-origin resource sharing |
| `dotenv` | Environment variable loading |

## Installation

```bash
# 1. Clone the repository and navigate to the server folder
cd server

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your MongoDB URI, JWT secret, and client URL

# 4. Start development server
node index.js
```

## Environment Variables

Create a `.env` file in the `server/` folder (see `.env.example`):

```
PORT=5000
DB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0
DB_NAME=pawadopt
JWT_SECRET=your_long_random_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
DNS_SERVERS=8.8.8.8,1.1.1.1
```

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/jwt` | Public | Issue JWT cookie + upsert user |
| POST | `/logout` | Public | Clear JWT cookie |
| GET | `/pets` | Public | List pets (search, filter, sort) |
| GET | `/pets/featured` | Public | 6 newest available pets |
| GET | `/pets/:id` | Private | Single pet detail |
| POST | `/pets` | Private | Add pet listing |
| PATCH | `/pets/:id` | Private (owner) | Update pet listing |
| DELETE | `/pets/:id` | Private (owner) | Delete pet + its requests |
| GET | `/my-listings` | Private | Owner's listings |
| POST | `/adoption-requests` | Private | Submit adoption request |
| GET | `/my-requests` | Private | User's sent requests |
| DELETE | `/adoption-requests/:id` | Private | Cancel a request |
| GET | `/pets/:id/requests` | Private (owner) | All requests for a pet |
| PATCH | `/adoption-requests/:id/approve` | Private (owner) | Approve request |
| PATCH | `/adoption-requests/:id/reject` | Private (owner) | Reject request |

## Deployment (Render)

1. Push the `server/` folder to a separate GitHub repository.
2. Create a new **Web Service** on [render.com](https://render.com).
3. Set **Build Command**: `npm install`  
   Set **Start Command**: `node index.js`
4. Add all environment variables in the Render dashboard (use `NODE_ENV=production`).
5. Set `CLIENT_URL` to your Vercel frontend URL.
6. Deploy. Render will keep the service alive on the free tier.
