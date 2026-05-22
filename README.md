# PawAdopt Server

This is the backend API for PawAdopt. It manages users, pets, adoption requests, and wishlists. The frontend talks to this server through cookie-based JWT authentication, so protected actions stay secure without exposing the token in local storage.

Live API: `https://pawadopt-server.onrender.com`

## Main Features

- Issues JWT tokens and stores them in HTTPOnly cookies.
- Stores all platform data in MongoDB.
- Lets users browse pets with search, species filtering, status filtering, and sorting.
- Lets owners add, edit, and delete only their own pet listings.
- Blocks owners from requesting adoption for their own pets.
- Approves only one adoption request for a pet and rejects the other pending requests.
- Supports wishlist add, list, and remove actions.
- Includes a `/health/db` route to confirm the database connection.

## Packages Used

| Package | Why it is used |
| --- | --- |
| `express` | API server and route handling |
| `mongodb` | Native MongoDB driver |
| `jsonwebtoken` | JWT creation and verification |
| `cookie-parser` | Read and clear HTTPOnly auth cookies |
| `cors` | Allow the deployed client to call the API |
| `dotenv` | Load local environment variables |
| `nodemon` | Restart server during development |

## Local Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```bash
PORT=8000
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=pawadopt
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
DNS_SERVERS=8.8.8.8,1.1.1.1
```

Start in development mode:

```bash
npm run dev
```

Start in production mode:

```bash
npm start
```

## API Routes

### System

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/` | Public | Basic server check |
| GET | `/health/db` | Public | MongoDB ping check |

### Auth and Users

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/jwt` | Public | Create JWT cookie and upsert user |
| POST | `/users` | Public | Save or update user profile |
| POST | `/logout` | Public | Clear auth cookie |
| GET | `/me` | Private | Return current user info |

### Pets

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/pets` | Public | Browse pets |
| GET | `/pets/featured` | Public | Get six latest available pets |
| GET | `/pets/:id` | Private | Get one pet profile |
| POST | `/pets` | Private | Add a pet listing |
| PATCH | `/pets/:id` | Owner only | Update a listing |
| DELETE | `/pets/:id` | Owner only | Delete a listing and its requests |
| GET | `/my-listings` | Private | Get current user's listings |

### Adoption Requests

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/adoption-requests` | Private | Send an adoption request |
| GET | `/my-requests` | Private | Get requests sent by current user |
| DELETE | `/adoption-requests/:id` | Private | Cancel a sent request |
| GET | `/pets/:id/requests` | Owner only | Get requests for one pet |
| PATCH | `/adoption-requests/:id/approve` | Owner only | Approve a request |
| PATCH | `/adoption-requests/:id/reject` | Owner only | Reject a request |

### Wishlist

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/wishlists` | Private | Save a pet |
| GET | `/wishlists` | Private | Get saved pets |
| DELETE | `/wishlists/:petId` | Private | Remove a saved pet |

## Query Examples

```text
/pets?search=milo
/pets?species=Cat,Dog
/pets?status=available
/pets?sort=fee-asc
```

## Deployment Notes

The server is deployed on Render. MongoDB credentials, JWT secret, client URL, and DNS settings are stored as environment variables in the Render dashboard.
