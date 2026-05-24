// Scripts for firebase messaging inside service worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Note: These values don't need real keys for compiling, but they are required to start the listener.
// In local dev and tests, if keys are missing, the worker remains registered without throwing.
firebase.initializeApp({
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: "mock-project-id",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || "L'Insociable Coach";
  const notificationOptions = {
    body: payload.notification.body || "Nouveau message du coach.",
    icon: payload.notification.icon || '/logo.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
