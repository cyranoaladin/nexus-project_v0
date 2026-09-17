/* Generated from lib/auth: one canonical recovery controller. */
(function(global) {
const modules = {"./client-session-recovery": function(exports, require) {
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRecoveryController = void 0;
exports.sessionIdentity = sessionIdentity;
/** Compare authority/identity claims, never rotating expiry. No V1 database assumptions. */
function sessionIdentity(session) {
    if (!session)
        return '';
    const { expires: _expires, ...claims } = session;
    return JSON.stringify(claims, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
function isSession(value) {
    if (!value || typeof value !== 'object' || !('user' in value) || !('expires' in value)
        || typeof value.expires !== 'string' || !value.user || typeof value.user !== 'object')
        return false;
    return 'id' in value.user && typeof value.user.id === 'string' && value.user.id.length > 0
        && 'role' in value.user && typeof value.user.role === 'string' && value.user.role.length > 0;
}
/**
 * Shared extraction of #235: authoritative confirmation, bounded transport,
 * generation cancellation and getSession broadcast into the existing provider.
 * The retained view is only a draft/display owner, NOT permission to mutate.
 */
class SessionRecoveryController {
    constructor(verify, synchronize, serverSession = null, renderedScope, projectionMode = 'authjs') {
        this.verify = verify;
        this.synchronize = synchronize;
        this.renderedScope = renderedScope;
        this.projectionMode = projectionMode;
        this.listeners = new Set();
        this.raw = { data: null, status: 'loading' };
        this.route = null;
        this.generation = 0;
        this.request = null;
        this.deadline = null;
        this.confirmation = null;
        this.logoutIntent = false;
        this.logoutDestination = '/auth/signin';
        this.subscribe = (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
        this.getView = () => this.view;
        this.getSnapshot = () => this.observation;
        this.getRedirectDestination = () => this.logoutDestination;
        this.stop = () => { this.cancel(); this.route = null; this.publish('RECOVERING'); };
        this.retry = () => {
            // Retrying observes the server; it never replays a pending logout write.
            // The new generation supersedes that operation's eventual client result.
            this.logoutIntent = false;
            this.start();
        };
        this.beginLogout = (destination = '/auth/signin') => {
            this.logoutDestination = destination;
            this.logoutIntent = true;
            this.cancel();
            this.publish('RECOVERING');
            return this.generation;
        };
        this.confirmLogout = (operation) => {
            if (!this.logoutIntent || operation !== this.generation)
                return;
            this.cancel();
            this.publish('UNAUTHENTICATED_CONFIRMED', null);
        };
        this.runLogout = async (perform, destination) => {
            const operation = this.beginLogout(destination);
            const abort = new AbortController();
            let timer;
            const current = () => {
                if (!this.logoutIntent || operation !== this.generation || abort.signal.aborted)
                    throw new Error('SESSION_OPERATION_SUPERSEDED');
            };
            try {
                timer = setTimeout(() => {
                    if (this.logoutIntent && operation === this.generation)
                        this.publish('UNAVAILABLE');
                }, 10000);
                const result = await perform();
                current();
                const response = await this.verify(abort.signal);
                if (!response.ok || await response.json() !== null)
                    throw new Error('LOGOUT_NOT_CONFIRMED');
                current();
                this.confirmLogout(operation);
                return result;
            }
            catch (error) {
                this.failedLogout(operation);
                throw error;
            }
            finally {
                if (timer)
                    clearTimeout(timer);
                abort.abort();
            }
        };
        this.failedLogout = (operation) => {
            if (!this.logoutIntent || operation !== this.generation)
                return;
            this.cancel();
            this.logoutIntent = false;
            this.publish('UNAVAILABLE');
        };
        this.enteredPublicRoute = () => {
            this.stop();
            this.logoutIntent = false;
            this.logoutDestination = '/auth/signin';
            this.publish('LOADING', null);
        };
        /** Capture before an async chain; check again before its next side effect. */
        this.captureObservation = () => {
            const epoch = this.observation.identityEpoch;
            const route = this.renderedScope?.().route ?? this.route;
            // Initial reads can start alongside first verification; an already-verified
            // read is retired by any subsequent recovery, logout or navigation.
            const generation = this.observation.canMutate && route === this.route ? this.generation : null;
            return () => {
                const rendered = this.renderedScope?.();
                if (this.observation.identityEpoch !== epoch || (rendered?.route ?? this.route) !== route
                    || (rendered && !rendered.active) || this.observation.state.endsWith('_CONFIRMED')
                    || this.logoutIntent || (generation !== null && this.generation !== generation)) {
                    throw new Error('SESSION_OBSERVATION_SUPERSEDED');
                }
            };
        };
        this.bindDeferredMutation = (task) => {
            let check;
            try {
                check = this.captureMutation();
            }
            catch {
                return () => { };
            }
            return () => {
                try {
                    check();
                }
                catch {
                    return;
                }
                task();
            };
        };
        this.captureMutation = () => {
            const epoch = this.observation.identityEpoch;
            const generation = this.generation;
            const check = () => {
                const rendered = this.renderedScope?.();
                if (rendered && (!rendered.active || rendered.route !== this.route || rendered.raw.status !== 'authenticated'
                    || sessionIdentity(rendered.raw.data) !== sessionIdentity(this.view.data))) {
                    throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
                }
                if (!this.observation.canMutate || this.observation.identityEpoch !== epoch || this.generation !== generation) {
                    throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
                }
            };
            check();
            return check;
        };
        this.view = { data: serverSession, status: serverSession ? 'authenticated' : 'loading' };
        this.observation = { state: serverSession ? 'AUTHENTICATED' : 'LOADING', canMutate: false, protectedScope: !!renderedScope?.().active, identityEpoch: 0 };
    }
    publish(state, data = this.view.data) {
        const changedIdentity = sessionIdentity(data) !== sessionIdentity(this.view.data);
        const status = data ? 'authenticated' : state.endsWith('_CONFIRMED') ? 'unauthenticated' : 'loading';
        // Preserve object identity during recovery AND same-identity provider refresh.
        // Effects depending on session/status must not reload and overwrite drafts.
        if (changedIdentity || status !== this.view.status)
            this.view = { data, status };
        this.observation = {
            state, canMutate: !!this.route && state === 'AUTHENTICATED', protectedScope: !!this.route,
            identityEpoch: this.observation.identityEpoch + Number(changedIdentity),
        };
        this.listeners.forEach(listener => listener());
    }
    cancel() {
        this.generation++;
        this.request?.abort();
        this.request = null;
        this.confirmation = null;
        if (this.deadline)
            clearTimeout(this.deadline);
        this.deadline = null;
    }
    observe(raw, route) {
        const changedRoute = this.route !== route;
        this.raw = raw;
        this.route = route;
        if (this.logoutIntent)
            return;
        if (raw.data && this.view.data && sessionIdentity(raw.data) !== sessionIdentity(this.view.data)) {
            this.cancel();
            this.publish('RECOVERING', null);
            this.start();
            return;
        }
        if (changedRoute) {
            this.start();
            return;
        }
        if (this.confirmation && raw.status === 'authenticated'
            && sessionIdentity(raw.data) === sessionIdentity(this.confirmation)) {
            this.accept(this.confirmation);
            return;
        }
        if (this.request || this.observation.state === 'UNAVAILABLE' || this.observation.state.endsWith('_CONFIRMED'))
            return;
        if (raw.status !== 'authenticated' || !raw.data)
            this.start();
    }
    accept(session) {
        this.cancel();
        this.publish('AUTHENTICATED', session);
    }
    start() {
        this.cancel();
        if (!this.route || this.logoutIntent)
            return;
        const generation = this.generation;
        const controller = new AbortController();
        this.request = controller;
        const current = () => this.generation === generation && !controller.signal.aborted && !this.logoutIntent;
        this.publish(this.view.data ? 'RECOVERING' : 'LOADING');
        this.deadline = setTimeout(() => {
            if (!current())
                return;
            // Ten seconds degrades the UI only. A slow authoritative response
            // must still recover or retire the session without another attempt.
            this.deadline = null;
            this.publish('UNAVAILABLE');
        }, 10000);
        void (async () => {
            try {
                const response = await this.verify(controller.signal);
                if (!response.ok)
                    throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
                const confirmed = await response.json();
                if (!current())
                    return;
                if (confirmed === null) {
                    const wasAuthenticated = !!this.view.data;
                    this.cancel();
                    this.publish(wasAuthenticated ? 'REVOKED_CONFIRMED' : 'UNAUTHENTICATED_CONFIRMED', null);
                    return;
                }
                if (!isSession(confirmed))
                    throw new Error('SESSION_VERIFICATION_UNAVAILABLE');
                if (this.projectionMode === 'canonical-server') {
                    this.accept(confirmed);
                    return;
                }
                this.confirmation = confirmed;
                if (this.raw.status === 'authenticated' && sessionIdentity(this.raw.data) === sessionIdentity(confirmed)) {
                    this.accept(confirmed);
                    return;
                }
                // This is NOT update(): #235 proved update-only poisons Auth.js's
                // internal null cache and prevents later focus revocation refresh.
                const recovered = await this.synchronize();
                if (!current())
                    return;
                if (!isSession(recovered) || sessionIdentity(recovered) !== sessionIdentity(confirmed)) {
                    throw new Error('SESSION_RECOVERY_UNAVAILABLE');
                }
                // Provider concordance is observed separately, not inferred from this
                // fetch result; the remaining deadline also bounds a stuck broadcast.
                if (this.raw.status === 'authenticated' && sessionIdentity(this.raw.data) === sessionIdentity(confirmed))
                    this.accept(confirmed);
            }
            catch {
                if (!current())
                    return;
                // An early transport failure is still recovery, not logout. Keep the
                // original UX deadline; explicit retry can start a fresh attempt.
                this.confirmation = null;
            }
        })();
    }
}
exports.SessionRecoveryController = SessionRecoveryController;

},
"./static-session-recovery": function(exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountStaticSessionRecovery = mountStaticSessionRecovery;
const client_session_recovery_1 = require("./client-session-recovery");
/** DOM projection for the standalone Planning document; all policy stays in the shared controller. */
function mountStaticSessionRecovery(options) {
    const root = document.getElementById('app');
    const modalRoot = document.getElementById('modalRoot');
    if (!root || !modalRoot)
        throw new Error('PROTECTED_PLANNING_ROOT_REQUIRED');
    const controller = new client_session_recovery_1.SessionRecoveryController(signal => fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal }), async () => null, null, undefined, 'canonical-server');
    const disabled = new Map();
    const waiters = new Set();
    let identity = '';
    let retired = false;
    const banner = document.createElement('div');
    root.before(banner);
    function notice(container, visible, unavailable) {
        let element = container.querySelector(':scope > [data-session-notice]');
        if (!element) {
            element = document.createElement('div');
            element.dataset.sessionNotice = 'true';
            element.setAttribute('role', 'status');
            element.className = 'session-recovery-notice';
            const message = document.createElement('p');
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'btn';
            retry.dataset.sessionRecoveryControl = 'true';
            retry.textContent = 'Réessayer la vérification';
            retry.addEventListener('click', controller.retry);
            element.append(message, retry);
            container.prepend(element);
        }
        element.hidden = !visible;
        const message = unavailable
            ? 'La vérification de session est indisponible. Votre travail est conservé ; les actions sont suspendues.'
            : 'Vérification de votre session en cours. Votre travail est conservé.';
        if (element.firstElementChild?.textContent !== message)
            element.firstElementChild.textContent = message;
    }
    function update() {
        if (retired)
            return;
        const snapshot = controller.getSnapshot();
        if (snapshot.state.endsWith('_CONFIRMED')) {
            retired = true;
            root.replaceChildren();
            modalRoot.replaceChildren();
            waiters.forEach(waiter => waiter.reject(new Error('SESSION_TERMINATED')));
            waiters.clear();
            options.onSessionEnded();
            return;
        }
        const nextIdentity = (0, client_session_recovery_1.sessionIdentity)(controller.getView().data);
        if (nextIdentity && identity && nextIdentity !== identity) {
            retired = true;
            controller.stop();
            root.replaceChildren();
            modalRoot.replaceChildren();
            waiters.forEach(waiter => waiter.reject(new Error('SESSION_IDENTITY_CHANGED')));
            waiters.clear();
            options.onIdentityChanged();
            return;
        }
        if (nextIdentity)
            identity = nextIdentity;
        const visible = !snapshot.canMutate;
        notice(banner, visible, snapshot.state === 'UNAVAILABLE');
        // The mobile editor drawer overlays the global banner. Keep recovery
        // controls inside that surface, outside its replaceable editor body.
        const side = root.querySelector('#side');
        if (side)
            notice(side, visible, snapshot.state === 'UNAVAILABLE');
        modalRoot.querySelectorAll('.modal').forEach(modal => notice(modal, visible, snapshot.state === 'UNAVAILABLE'));
        for (const scope of [root, modalRoot]) {
            scope.querySelectorAll('input,button,select,textarea').forEach(control => {
                if (control.closest('[data-session-notice]'))
                    return;
                if (visible) {
                    if (!disabled.has(control))
                        disabled.set(control, control.disabled);
                    control.disabled = true;
                }
            });
        }
        if (!visible) {
            disabled.forEach((wasDisabled, control) => { control.disabled = wasDisabled; });
            disabled.clear();
            waiters.forEach(waiter => waiter.resolve());
            waiters.clear();
        }
    }
    const unsubscribe = controller.subscribe(update);
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true });
    observer.observe(modalRoot, { childList: true, subtree: true });
    const block = (event) => {
        if (controller.getSnapshot().canMutate)
            return;
        const element = event.target instanceof Element ? event.target : null;
        if (element?.closest('[data-session-recovery-control]'))
            return;
        if (element && (root.contains(element) || modalRoot.contains(element))) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };
    for (const type of ['click', 'submit', 'keydown', 'pointerdown', 'drop'])
        document.addEventListener(type, block, true);
    const observe = () => controller.observe({ data: null, status: 'loading' }, location.pathname + location.search);
    const refresh = () => { if (!retired && document.visibilityState !== 'hidden')
        controller.retry(); };
    const restore = (event) => { if (event.persisted && !retired)
        observe(); };
    const stop = () => controller.stop();
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', restore);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('next-auth');
    channel?.addEventListener('message', refresh);
    observe();
    return {
        controller,
        /** Bootstrap/readiness only. Privileged actions must capture a ticket, never await/replay here. */
        whenVerified() {
            if (retired)
                return Promise.reject(new Error('SESSION_TERMINATED'));
            if (controller.getSnapshot().canMutate)
                return Promise.resolve();
            return new Promise((resolve, reject) => { waiters.add({ resolve, reject }); });
        },
        destroy() {
            retired = true;
            unsubscribe();
            observer.disconnect();
            controller.stop();
            channel?.close();
            waiters.forEach(waiter => waiter.reject(new Error('SESSION_OBSERVER_STOPPED')));
            waiters.clear();
            for (const type of ['click', 'submit', 'keydown', 'pointerdown', 'drop'])
                document.removeEventListener(type, block, true);
            window.removeEventListener('pagehide', stop);
            window.removeEventListener('pageshow', restore);
            window.removeEventListener('online', refresh);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
            banner.remove();
        },
    };
}

}};
const cache = {};
function require(id) { if (!cache[id]) { cache[id] = {}; modules[id](cache[id], require); } return cache[id]; }
global.NexusSessionRecovery = require('./static-session-recovery');
})(window);
