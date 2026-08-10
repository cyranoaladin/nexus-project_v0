// Real-database tests exercise activation URL generation without relying on a
// developer shell or a repository .env file. This origin is local-only and is
// installed before application modules are evaluated.
process.env.NEXTAUTH_URL = 'http://localhost:3000';
