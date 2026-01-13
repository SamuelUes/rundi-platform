/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

if (!firebase.apps.length) {
  firebase.initializeApp({
    messagingSenderId: "608732245640",
  });
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload?.notification?.title || "Rundi";
  const notificationOptions = {
    body: payload?.notification?.body || "Tienes una nueva notificación",
    icon: "/icons/icon-192x192.png",
    data: payload?.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
