# PawAdopt Server

PawAdopt Server is the REST API for the PawAdopt pet adoption platform. It handles authentication, pet listings, adoption requests, wishlist items, and owner-only adoption decisions.

## Live URL

`https://pawadopt-server.onrender.com`

## Features

- JWT authentication with HTTPOnly cookies
- Public pet browsing with search, species filter, status filter, and sorting
- Protected pet detail, pet creation, listing update, and listing delete routes
- Owner-only adoption request approval and rejection
- Automatic rejection of other pending requests after one request is approved
- Wishlist add, list, and remove routes
- MongoDB indexes for common lookup fields
- Central error handling middleware

## Tech Stack

- Node.js
- Express.js
- MongoDB native driver
- jsonwebtoken
- cookie-parser
- cors
- dotenv

## Local Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file from `.env.example`:

```bash
PORT=8000
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=pawadopt
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
DNS_SERVERS=8.8.8.8,1.1.1.1
```

Start the server:

```bash
npm run dev
```

Production start command:

```bash
npm start
```

## API Endpoints

### System

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | Server status |
| GET | `/health/db` | Public | MongoDB connection health |

### Auth and Users

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/jwt` | Public | Issue JWT cookie and upsert user |
| POST | `/users` | Public | Upsert user profile |
| POST | `/logout` | Public | Clear JWT cookie |
| GET | `/me` | Private | Get current user |

### Pets

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/pets` | Public | List pets with search, filter, and sort |
| GET | `/pets/featured` | Public | Get newest available pets |
| GET | `/pets/:id` | Private | Get one pet |
| POST | `/pets` | Private | Add a pet listing |
| PATCH | `/pets/:id` | Private owner | Update a pet listing |
| DELETE | `/pets/:id` | Private owner | Delete a pet and its requests |
| GET | `/my-listings` | Private | Get listings created by the current user |

### Adoption Requests

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/adoption-requests` | Private | Submit an adoption request |
| GET | `/my-requests` | Private | Get current user's sent requests |
| DELETE | `/adoption-requests/:id` | Private | Cancel a request |
| GET | `/pets/:id/requests` | Private owner | Get requests for one pet |
| PATCH | `/adoption-requests/:id/approve` | Private owner | Approve a request |
| PATCH | `/adoption-requests/:id/reject` | Private owner | Reject a request |

### Wishlist

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/wishlists` | Private | Add a pet to wishlist |
| GET | `/wishlists` | Private | Get current user's wishlist |
| DELETE | `/wishlists/:petId` | Private | Remove a pet from wishlist |

## Query Options

`GET /pets` supports:

```text
search=pet name
species=Cat,Dog
status=available
sort=fee-asc | fee-desc | name-asc | newest
```

## Deployment

The API is deployed on Render. Set these environment variables in the Render dashboard:

```text
PORT
DB_URI
DB_NAME
JWT_SECRET
CLIENT_URL
NODE_ENV
DNS_SERVERS
```

For production, set `NODE_ENV=production` and set `CLIENT_URL` to the deployed frontend URL.
