const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const dns = require("dns");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const verifyToken = require("./middleware/verifyToken");
const errorHandler = require("./middleware/errorHandler");
const cookieOptions = require("./utils/cookieOptions");

const app = express();
const port = process.env.PORT || 8000;

dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(","));

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = process.env.DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const isValidObjectId = (id) => ObjectId.isValid(id);

const getSortQuery = (sort) => {
  if (sort === "fee-asc") return { adoptionFee: 1 };
  if (sort === "fee-desc") return { adoptionFee: -1 };
  if (sort === "name-asc") return { petName: 1 };
  return { createdAt: -1 };
};

const cleanPetData = (data) => {
  const allowedFields = [
    "petName",
    "species",
    "breed",
    "age",
    "gender",
    "imageUrl",
    "healthStatus",
    "vaccinationStatus",
    "location",
    "adoptionFee",
    "description",
    "ownerName",
  ];

  const pet = {};

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      pet[field] = data[field];
    }
  });

  if (pet.adoptionFee !== undefined) {
    pet.adoptionFee = Number(pet.adoptionFee);
  }

  return pet;
};

app.get("/", (req, res) => {
  res.send("PawAdopt server is running.");
});

async function server() {
  try {
    await client.connect();

    const db = client.db(process.env.DB_NAME || "pawadopt");
    const usersCollection = db.collection("users");
    const petsCollection = db.collection("pets");
    const adoptionRequestsCollection = db.collection("adoptionRequests");
    const wishlistsCollection = db.collection("wishlists");

    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await petsCollection.createIndex({ ownerEmail: 1 });
    await petsCollection.createIndex({ petName: 1 });
    await petsCollection.createIndex({ species: 1 });
    await adoptionRequestsCollection.createIndex({ requesterEmail: 1 });
    await adoptionRequestsCollection.createIndex({ petId: 1, requesterEmail: 1 });
    await wishlistsCollection.createIndex({ petId: 1, userEmail: 1 }, { unique: true });

    app.get("/health/db", async (req, res) => {
      await db.command({ ping: 1 });
      res.send({ connected: true, database: db.databaseName });
    });

    // Auth API
    app.post("/jwt", async (req, res) => {
      const { email, name, photoURL } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const user = {
        email,
        name: name || "",
        photoURL: photoURL || "",
        lastLogin: new Date(),
      };

      await usersCollection.updateOne(
        { email },
        {
          $set: user,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

      res
        .cookie("pawadopt_token", token, cookieOptions)
        .send({ success: true, email });
    });

    app.post("/users", async (req, res) => {
      const { email, name, photoURL } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const user = {
        email,
        name: name || "",
        photoURL: photoURL || "",
        updatedAt: new Date(),
      };

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: user,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      res.send(result);
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("pawadopt_token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.get("/me", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.decoded.email });
      res.send(user || req.decoded);
    });

    // Pets API
    app.get("/pets", async (req, res) => {
      const { search, species, sort, status } = req.query;
      const query = {};

      if (search) {
        query.petName = { $regex: search, $options: "i" };
      }

      if (species) {
        const speciesList = species.split(",").map((item) => item.trim());
        query.species = { $in: speciesList };
      }

      if (status) {
        query.status = status;
      }

      const result = await petsCollection
        .find(query)
        .sort(getSortQuery(sort))
        .toArray();

      res.send(result);
    });

    app.get("/pets/featured", async (req, res) => {
      const result = await petsCollection
        .find({ status: "available" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    app.get("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid pet id" });
      }

      const query = { _id: new ObjectId(id) };
      const result = await petsCollection.findOne(query);

      if (!result) {
        return res.status(404).send({ message: "Pet not found" });
      }

      res.send(result);
    });

    app.post("/pets", verifyToken, async (req, res) => {
      const newPet = cleanPetData(req.body);

      if (!newPet.petName || !newPet.species || !newPet.imageUrl) {
        return res.status(400).send({ message: "Pet name, species, and image are required" });
      }

      newPet.ownerEmail = req.decoded.email;
      newPet.ownerName = newPet.ownerName || req.decoded.name || "";
      newPet.status = "available";
      newPet.createdAt = new Date();
      newPet.updatedAt = new Date();

      const result = await petsCollection.insertOne(newPet);
      res.status(201).send(result);
    });

    app.patch("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid pet id" });
      }

      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });

      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      if (pet.ownerEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const updatedData = cleanPetData(req.body);
      updatedData.updatedAt = new Date();

      const result = await petsCollection.updateOne(
        { _id: new ObjectId(id), ownerEmail: email },
        { $set: updatedData }
      );

      res.send(result);
    });

    app.delete("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid pet id" });
      }

      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });

      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      if (pet.ownerEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await petsCollection.deleteOne({
        _id: new ObjectId(id),
        ownerEmail: email,
      });

      await adoptionRequestsCollection.deleteMany({ petId: id });

      res.send(result);
    });

    app.get("/my-listings", verifyToken, async (req, res) => {
      const email = req.decoded.email;

      const result = await petsCollection
        .find({ ownerEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Adoption request API
    app.post("/adoption-requests", verifyToken, async (req, res) => {
      const { petId, pickupDate, message } = req.body;
      const requesterEmail = req.decoded.email;

      if (!petId || !pickupDate) {
        return res.status(400).send({ message: "Pet and pickup date are required" });
      }

      if (!isValidObjectId(petId)) {
        return res.status(400).send({ message: "Invalid pet id" });
      }

      const pet = await petsCollection.findOne({ _id: new ObjectId(petId) });

      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      if (pet.ownerEmail === requesterEmail) {
        return res.status(403).send({ message: "Owners cannot adopt their own pets" });
      }

      if (pet.status === "adopted") {
        return res.status(409).send({ message: "This pet is already adopted" });
      }

      const existingRequest = await adoptionRequestsCollection.findOne({
        petId,
        requesterEmail,
        status: { $in: ["pending", "approved"] },
      });

      if (existingRequest) {
        return res.status(409).send({ message: "You already requested this pet" });
      }

      const newRequest = {
        petId,
        petName: pet.petName,
        petImage: pet.imageUrl,
        requesterName: req.decoded.name || req.body.requesterName || "",
        requesterEmail,
        ownerEmail: pet.ownerEmail,
        pickupDate,
        message: message || "",
        status: "pending",
        requestDate: new Date(),
      };

      const result = await adoptionRequestsCollection.insertOne(newRequest);
      res.status(201).send(result);
    });

    app.get("/my-requests", verifyToken, async (req, res) => {
      const email = req.decoded.email;

      const result = await adoptionRequestsCollection
        .find({ requesterEmail: email })
        .sort({ requestDate: -1 })
        .toArray();

      res.send(result);
    });

    app.delete("/adoption-requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid request id" });
      }

      const result = await adoptionRequestsCollection.deleteOne({
        _id: new ObjectId(id),
        requesterEmail: email,
      });

      if (!result.deletedCount) {
        return res.status(404).send({ message: "Request not found" });
      }

      res.send(result);
    });

    app.get("/pets/:id/requests", verifyToken, async (req, res) => {
      const petId = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(petId)) {
        return res.status(400).send({ message: "Invalid pet id" });
      }

      const pet = await petsCollection.findOne({ _id: new ObjectId(petId) });

      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      if (pet.ownerEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await adoptionRequestsCollection
        .find({ petId })
        .sort({ requestDate: -1 })
        .toArray();

      res.send(result);
    });

    app.patch("/adoption-requests/:id/approve", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid request id" });
      }

      const request = await adoptionRequestsCollection.findOne({ _id: new ObjectId(id) });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      if (request.ownerEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      if (request.status !== "pending") {
        return res.status(400).send({ message: "Only pending requests can be approved" });
      }

      const petResult = await petsCollection.updateOne(
        {
          _id: new ObjectId(request.petId),
          ownerEmail: email,
          status: "available",
        },
        {
          $set: {
            status: "adopted",
            updatedAt: new Date(),
          },
        }
      );

      if (!petResult.modifiedCount) {
        return res.status(409).send({ message: "This pet is already adopted" });
      }

      const approveResult = await adoptionRequestsCollection.updateOne(
        { _id: new ObjectId(id), ownerEmail: email },
        {
          $set: {
            status: "approved",
            decidedAt: new Date(),
          },
        }
      );

      await adoptionRequestsCollection.updateMany(
        {
          petId: request.petId,
          _id: { $ne: new ObjectId(id) },
          status: "pending",
        },
        {
          $set: {
            status: "rejected",
            decidedAt: new Date(),
          },
        }
      );

      res.send(approveResult);
    });

    app.patch("/adoption-requests/:id/reject", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: "Invalid request id" });
      }

      const request = await adoptionRequestsCollection.findOne({ _id: new ObjectId(id) });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      if (request.ownerEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      if (request.status !== "pending") {
        return res.status(400).send({ message: "Only pending requests can be rejected" });
      }

      const result = await adoptionRequestsCollection.updateOne(
        { _id: new ObjectId(id), ownerEmail: email },
        {
          $set: {
            status: "rejected",
            decidedAt: new Date(),
          },
        }
      );

      res.send(result);
    });
    // Wishlist API
    app.post("/wishlists", verifyToken, async (req, res) => {
      const userEmail = req.decoded.email;
      const { petId } = req.body;

      if (!petId || !isValidObjectId(petId)) {
        return res.status(400).send({ message: "Valid petId is required" });
      }

      const pet = await petsCollection.findOne({ _id: new ObjectId(petId) });
      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      const item = {
        petId,
        petName: pet.petName,
        petImage: pet.imageUrl,
        species: pet.species,
        breed: pet.breed,
        adoptionFee: pet.adoptionFee,
        status: pet.status,
        userEmail,
        createdAt: new Date(),
      };

      try {
        const result = await wishlistsCollection.insertOne(item);
        res.status(201).send(result);
      } catch (err) {
        if (err.code === 11000) {
          return res.status(409).send({ message: "Pet already in your wishlist" });
        }
        throw err;
      }
    });

    app.get("/wishlists", verifyToken, async (req, res) => {
      const userEmail = req.decoded.email;
      const items = await wishlistsCollection
        .find({ userEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(items);
    });

    app.delete("/wishlists/:petId", verifyToken, async (req, res) => {
      const userEmail = req.decoded.email;
      const { petId } = req.params;
      const result = await wishlistsCollection.deleteOne({ petId, userEmail });
      res.send(result);
    });


    app.use((req, res) => {
      res.status(404).send({ message: "API route not found" });
    });

    app.use(errorHandler);

    app.listen(port, () => {
      console.log(`PawAdopt server is running on port ${port}`);
    });

    console.log("Successfully connected to MongoDB.");
  } finally {
    // Keeps the MongoDB connection open for the server lifetime.
  }
}

server().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
