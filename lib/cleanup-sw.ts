// Nettoyage automatique des Service Workers résiduels
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (const registration of registrations) {
      // Désinscrire tous les SW qui ne sont pas de Next.js
      if (!registration.scope.includes('_next')) {
        registration.unregister().then(function () {
          console.log('Service Worker résiduel supprimé:', registration.scope);
        });
      }
    }
  });
}

export {};
