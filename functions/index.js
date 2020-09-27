const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();
app.use(cors());

// auth trigger (new user signup)
exports.newUserSignUp = functions.auth.user().onCreate(user => {
    // for background triggers you must return a value/promise
    return admin.firestore().collection('users').doc(user.uid).set({
        email: user.email,
        upvotedOn: [],
    });
});

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete(user => {
    const doc = admin.firestore().collection('users').doc(user.uid);
    return doc.delete();
});

// http callable function (adding a request)
exports.addRequest = functions.https.onCall((data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'only authenticated users can add requests'
        );
    }
    if (data.text.length > 30) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'request must be no more than 30 characters long'
        );
    }
    return admin.firestore().collection('requests').add({
        text: data.text,
        upvotes: 0
    });
});

// // upvote callable function
exports.upvote = functions.https.onCall(async (data, context) => {
    // check auth state
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'only authenticated users can vote up requests'
        );
    }
    // get refs for user doc & request doc
    const user = admin.firestore().collection('users').doc(context.auth.uid);
    const request = admin.firestore().collection('requests').doc(data.id);

    const doc = await user.get();

    // check thew user hasn't already upvoted
    if (doc.data().upvotedOn.includes(data.id)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'You can only vote something up once'
        );
    }

    // update the array in user document
    await user.update({
        upvotedOn: [...doc.data().upvotedOn, data.id]
    });

    // update the votes on the request
    return request.update({
        upvotes: admin.firestore.FieldValue.increment(1)
    });
});
//Firestore trigger for tracking activities
exports.logActivities = functions.firestore.document('/{collection}/{id}')
    .onCreate((snap, context) => {
        const collection = context.params.collection;
        const id = context.params.id;
        const activities = admin.firestore().collection('activities');

        if (collection === 'requests') {
            return activities.add({ text: 'A new request has been added.' });
        }
        if (collection === 'users') {
            return activities.add({ text: 'A new user has signed up.' });
        }
        return null;
    });

//Express API

app.get("/", async (req, res) => {
    const snapshot = await admin.firestore().collection("users").get();

    let users = [];
    snapshot.forEach((doc) => {
        let id = doc.id;
        let data = doc.data();

        users.push({ id, ...data });
    });

    res.status(200).send(JSON.stringify(users));
});

app.get("/:id", async (req, res) => {
    const snapshot = await admin.firestore().collection('users').doc(req.params.id).get();

    const userId = snapshot.id;
    const userData = snapshot.data();

    res.status(200).send(JSON.stringify({ id: userId, ...userData }));
});

app.post("/", async (req, res) => {
    const user = req.body;

    await admin.firestore().collection("users").add(user);

    res.status(201).send();
});

app.put("/:id", async (req, res) => {
    const body = req.body;

    await admin.firestore().collection('users').doc(req.params.id).update(body);

    res.status(200).send();
});

app.delete("/:id", async (req, res) => {
    await admin.firestore().collection("users").doc(req.params.id).delete();

    res.status(200).send();
});

exports.user = functions.https.onRequest(app);
