/**
 * 785 Tickets — embeddable ticket widget
 *
 * Usage on a seller's own website:
 *
 *   <div data-785-event="my-event-slug"></div>
 *   <script src="https://seveneightfive.com/embed/tickets.js" async></script>
 *
 * Renders entirely inside a Shadow DOM root attached to the div, so
 * the host site's CSS/JS can't collide with the widget and vice versa
 * — no iframe needed. Free RSVPs complete fully inline. Paid checkout
 * uses Stripe's Embedded Checkout, which mounts the actual payment
 * form inline too (via a small nested Stripe-controlled iframe for
 * PCI compliance) — the buyer never navigates away from the seller's
 * page for the common case. A very small number of payment methods
 * require an off-site redirect for bank authentication (3-D Secure);
 * for those, Stripe falls back to a full-page redirect to
 * seveneightfive.com/tickets/success, same page the main site uses.
 *
 * No dependencies, no build step — plain ES2017, works as-is in every
 * modern browser. Stripe.js is loaded lazily, only if/when a cart
 * actually contains a paid tier.
 */
(function () {
  'use strict';

  var scriptEl = document.currentScript;
  var API_BASE = (scriptEl && scriptEl.getAttribute('data-api-base')) || 'https://seveneightfive.com';

  var STRIPE_FEE_PERCENT = 0.029;
  var STRIPE_FIXED_FEE_CENTS = 30;
  function serviceFeeCents(priceInCents) {
    if (priceInCents <= 0) return 0;
    var est = Math.ceil(priceInCents * STRIPE_FEE_PERCENT) + STRIPE_FIXED_FEE_CENTS;
    return Math.ceil(est / 10) * 10;
  }
  function fmt(cents) { return '$' + (cents / 100).toFixed(2); }
  function isEmailish(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  var CSS = [
    ':host, .t785 { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }',
    '.t785 * { box-sizing: border-box; }',
    '.t785 { display: block; color: #1a1814; }',
    '.t785-wrap { border: 1.5px solid #ece8e2; border-radius: 12px; overflow: hidden; background: #f7f6f4; }',
    '.t785-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; user-select: none; }',
    '.t785-header-left { display: flex; flex-direction: column; gap: 3px; }',
    '.t785-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #b8b3ad; }',
    '.t785-price { font-size: 20px; font-weight: 600; color: #1a1814; }',
    '.t785-price-free { color: #2d7a2d; }',
    '.t785-price-note { font-size: 12px; font-weight: 400; color: #6b6560; margin-left: 6px; }',
    '.t785-btn { padding: 11px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; cursor: pointer; }',
    '.t785-btn.paid { background: #C80650; } .t785-btn.paid:hover { background: #a8041f; }',
    '.t785-btn.free { background: #2d7a2d; } .t785-btn.free:hover { background: #235e23; }',
    '.t785-btn.neutral { background: #b8b3ad; cursor: not-allowed; }',
    '.t785-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
    '.t785-expand { padding: 0 20px 20px; border-top: 1px solid #ece8e2; }',
    '.t785-close { font-size: 13px; color: #6b6560; cursor: pointer; }',
    '.t785-tiers { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }',
    '.t785-tier { padding: 12px 14px; border-radius: 8px; border: 1.5px solid #ece8e2; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
    '.t785-tier.in-cart { border-color: #C80650; background: rgba(200,6,80,0.04); }',
    '.t785-tier.locked { opacity: 0.45; }',
    '.t785-tier-name { font-weight: 500; font-size: 14px; }',
    '.t785-tier-desc { font-size: 12px; color: #6b6560; margin-top: 2px; }',
    '.t785-tier-note { font-size: 11px; color: #a85a30; font-weight: 500; margin-top: 2px; }',
    '.t785-tier-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }',
    '.t785-tier-price { font-weight: 600; font-size: 14px; }',
    '.t785-qty { display: flex; align-items: center; border: 1.5px solid #ece8e2; border-radius: 8px; overflow: hidden; }',
    '.t785-qty button { width: 28px; height: 28px; border: none; background: #fff; font-size: 15px; cursor: pointer; }',
    '.t785-qty button:disabled { color: #d8d3cd; cursor: not-allowed; }',
    '.t785-qty span { width: 28px; text-align: center; font-weight: 600; font-size: 13px; border-left: 1.5px solid #ece8e2; border-right: 1.5px solid #ece8e2; height: 28px; line-height: 28px; }',
    '.t785-lock-note { margin-top: 8px; font-size: 11px; color: #a85a30; }',
    '.t785-summary { margin-top: 16px; padding: 12px 14px; background: #fff; border: 1.5px solid #ece8e2; border-radius: 8px; }',
    '.t785-summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 6px; }',
    '.t785-summary-row:first-child { margin-top: 0; }',
    '.t785-summary-label { color: #6b6560; }',
    '.t785-summary-total { border-top: 1px solid #ece8e2; margin-top: 10px; padding-top: 10px; font-size: 15px; font-weight: 600; }',
    '.t785-row { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }',
    '.t785-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6560; }',
    '.t785-input { padding: 10px 12px; font-size: 14px; border: 1.5px solid #ece8e2; border-radius: 8px; background: #fff; color: #1a1814; outline: none; width: 100%; font-family: inherit; }',
    '.t785-input:focus { border-color: #C80650; }',
    '.t785-hint { font-size: 11px; color: #8a8580; }',
    '.t785-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid #ece8e2; }',
    '.t785-section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6560; margin-bottom: 10px; display: block; }',
    '.t785-card { padding: 14px; border: 1.5px solid #ece8e2; border-radius: 8px; background: #fff; margin-top: 10px; }',
    '.t785-card:first-child { margin-top: 0; }',
    '.t785-card-heading { font-size: 13px; font-weight: 600; margin-bottom: 10px; }',
    '.t785-card-heading span { font-weight: 400; color: #6b6560; }',
    '.t785-checkbox-row { display: flex; align-items: center; gap: 8px; }',
    '.t785-error { margin-top: 12px; padding: 10px 14px; background: rgba(200,6,80,0.08); border: 1px solid rgba(200,6,80,0.2); border-radius: 8px; font-size: 13px; color: #C80650; }',
    '.t785-confirm { margin-top: 16px; width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; cursor: pointer; }',
    '.t785-confirm.paid { background: #C80650; } .t785-confirm.paid:hover:not(:disabled) { background: #a8041f; }',
    '.t785-confirm.free { background: #2d7a2d; } .t785-confirm.free:hover:not(:disabled) { background: #235e23; }',
    '.t785-confirm.neutral { background: #b8b3ad; }',
    '.t785-confirm:disabled { opacity: 0.5; cursor: not-allowed; }',
    '.t785-done { padding: 16px 20px; display: flex; align-items: center; gap: 10px; background: rgba(45,122,45,0.06); }',
    '.t785-checkout-mount { margin-top: 16px; min-height: 400px; }',
    '.t785-badge { display: inline-block; font-size: 10px; color: #b8b3ad; margin-top: 10px; text-align: center; width: 100%; }',
    '.t785-loading, .t785-fatal { padding: 20px; font-size: 13px; color: #6b6560; text-align: center; }',
  ].join('\n');

  function mountWidget(hostEl) {
    var slug = hostEl.getAttribute('data-785-event');
    if (!slug) return;

    var shadow = hostEl.attachShadow ? hostEl.attachShadow({ mode: 'open' }) : hostEl;
    var styleTag = document.createElement('style');
    styleTag.textContent = CSS;
    shadow.appendChild(styleTag);

    var root = el('div', { class: 't785' });
    shadow.appendChild(root);
    root.appendChild(el('div', { class: 't785-loading', text: 'Loading tickets…' }));

    fetch(API_BASE + '/api/embed/events/' + encodeURIComponent(slug))
      .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
      .then(function (res) {
        root.innerHTML = '';
        if (!res.ok) {
          root.appendChild(el('div', { class: 't785-fatal', text: res.json.error || 'Tickets are not available for this event right now.' }));
          return;
        }
        new Widget(root, res.json).render();
      })
      .catch(function () {
        root.innerHTML = '';
        root.appendChild(el('div', { class: 't785-fatal', text: 'Could not load tickets. Please try again shortly.' }));
      });
  }

  function Widget(root, data) {
    this.root = root;
    this.event = data.event;
    this.tiers = data.tiers;
    this.eventLevelFields = data.eventLevel || [];
    this.tierFields = data.byTier || {};
    this.stripePublishableKey = data.stripePublishableKey;

    this.cart = {};
    this.attendeeNames = {};
    this.attendeeEmails = {};
    this.attendeeAnswers = {};
    this.manuallyEditedNames = {};
    this.guestName = '';
    this.guestEmail = '';
    this.guestPhone = '';
    this.expanded = false;
    this.purchasing = false;
    this.error = '';
    this.rsvpDone = false;
    this.embeddedCheckoutActive = false;
    this._stripe = null;
    this._embeddedCheckout = null;
  }

  Widget.prototype.cartEntries = function () {
    var self = this;
    return Object.keys(this.cart)
      .filter(function (id) { return self.cart[id] > 0; })
      .map(function (id) {
        var tier = self.tiers.filter(function (t) { return t.id === id; })[0];
        return tier ? { tier: tier, qty: self.cart[id] } : null;
      })
      .filter(Boolean);
  };

  Widget.prototype.totalQuantity = function () {
    return this.cartEntries().reduce(function (s, e) { return s + e.qty; }, 0);
  };
  Widget.prototype.cartHasPaid = function () {
    return this.cartEntries().some(function (e) { return e.tier.price > 0; });
  };
  Widget.prototype.cartHasFree = function () {
    return this.cartEntries().some(function (e) { return e.tier.price === 0; });
  };
  Widget.prototype.isFreeEvent = function () {
    return this.tiers.every(function (t) { return t.price === 0; });
  };
  Widget.prototype.tierLocked = function (tier) {
    return tier.price > 0 ? this.cartHasFree() : this.cartHasPaid();
  };
  Widget.prototype.maxQtyFor = function (tier) {
    var rem = tier.remaining;
    return Math.min(rem === null ? 10 : rem, 10);
  };
  Widget.prototype.questionsForTier = function (tierId) {
    return this.eventLevelFields.concat(this.tierFields[tierId] || []);
  };
  Widget.prototype.attendeeSlots = function () {
    var slots = [];
    this.cartEntries().forEach(function (e) {
      for (var i = 0; i < e.qty; i++) {
        slots.push({ key: e.tier.id + '__' + i, tierId: e.tier.id, tierName: e.tier.name });
      }
    });
    return slots;
  };

  Widget.prototype.setCart = function (tierId, qty) {
    this.cart[tierId] = Math.max(0, qty);
    this.error = '';
    this.render();
  };

  Widget.prototype.syncFirstAttendeeName = function () {
    var slots = this.attendeeSlots();
    if (!slots.length) return;
    var first = slots[0];
    if (this.manuallyEditedNames[first.key]) return;
    if (this.guestName) this.attendeeNames[first.key] = this.guestName;
  };

  Widget.prototype.validate = function () {
    if (this.totalQuantity() === 0) return 'Add at least one ticket.';
    if (!this.guestName.trim()) return 'Your name is required.';
    if (!isEmailish(this.guestEmail)) return 'Please enter a valid email.';
    if (this.cartHasPaid()) {
      var phoneDigits = (this.guestPhone || '').replace(/\D/g, '');
      if (phoneDigits.length < 10) return 'Please enter a valid phone number.';
    }
    var slots = this.attendeeSlots();
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var name = (this.attendeeNames[slot.key] || '').trim();
      var label = slots.length > 1 ? 'Attendee ' + (i + 1) + "'s" : "Attendee's";
      if (!name) return label + ' name is required.';
      var email = (this.attendeeEmails[slot.key] || '').trim();
      if (email && !isEmailish(email)) return label + " email doesn't look right.";
      var qs = this.questionsForTier(slot.tierId);
      for (var j = 0; j < qs.length; j++) {
        var q = qs[j];
        var val = ((this.attendeeAnswers[slot.key] || {})[q.id] || '').trim();
        if (q.is_required && !val) {
          return '"' + q.label + '" is required for ' + (slots.length > 1 ? 'Attendee ' + (i + 1) : 'this ticket') + '.';
        }
      }
    }
    return null;
  };

  Widget.prototype.buildAttendeesPayload = function () {
    var self = this;
    return this.attendeeSlots().map(function (slot) {
      var qs = self.questionsForTier(slot.tierId);
      var responses = qs.map(function (q) {
        return { field_id: q.id, value: ((self.attendeeAnswers[slot.key] || {})[q.id] || '').trim() };
      }).filter(function (r) { return r.value.length > 0; });
      return {
        tierId: slot.tierId,
        name: (self.attendeeNames[slot.key] || '').trim(),
        email: (self.attendeeEmails[slot.key] || '').trim() || null,
        responses: responses,
      };
    });
  };

  Widget.prototype.normalizePhone = function (raw) {
    var cleaned = (raw || '').replace(/[\s().\-]/g, '');
    if (!cleaned) return null;
    if (cleaned.indexOf('+') === 0) return cleaned.length >= 8 ? cleaned : null;
    var digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.indexOf('1') === 0) return '+' + digits;
    return null;
  };

  Widget.prototype.handleConfirm = function () {
    var self = this;
    self.error = '';
    var v = self.validate();
    if (v) { self.error = v; self.render(); return; }

    var items = self.cartEntries().map(function (e) { return { tierId: e.tier.id, quantity: e.qty }; });
    var attendees = self.buildAttendeesPayload();
    var guest = {
      name: self.guestName.trim(),
      email: self.guestEmail.trim().toLowerCase(),
      phone: self.normalizePhone(self.guestPhone),
    };

    self.purchasing = true;
    self.render();

    if (self.cartHasFree()) {
      fetch(API_BASE + '/api/embed/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug: self.event.slug, items: items, guest: guest, attendees: attendees }),
      })
        .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
        .then(function (res) {
          self.purchasing = false;
          if (!res.ok) { self.error = res.json.error || 'Something went wrong.'; self.render(); return; }
          self.rsvpDone = true;
          self.render();
        })
        .catch(function () {
          self.purchasing = false;
          self.error = 'Something went wrong. Please try again.';
          self.render();
        });
      return;
    }

    fetch(API_BASE + '/api/embed/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSlug: self.event.slug, items: items, guest: guest, attendees: attendees }),
    })
      .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
      .then(function (res) {
        if (!res.ok) {
          self.purchasing = false;
          self.error = res.json.error || 'Something went wrong.';
          self.render();
          return;
        }
        self.embeddedCheckoutActive = true;
        self.render();
        self.mountEmbeddedCheckout(res.json.clientSecret);
      })
      .catch(function () {
        self.purchasing = false;
        self.error = 'Something went wrong. Please try again.';
        self.render();
      });
  };

  Widget.prototype.loadStripeJs = function (cb) {
    if (window.Stripe) { cb(); return; }
    var existing = document.querySelector('script[data-t785-stripe-js]');
    if (existing) { existing.addEventListener('load', cb); return; }
    var s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.setAttribute('data-t785-stripe-js', '1');
    s.onload = cb;
    document.head.appendChild(s);
  };

  Widget.prototype.mountEmbeddedCheckout = function (clientSecret) {
    var self = this;
    if (!self.stripePublishableKey) {
      self.error = 'Payments are not configured for this event yet.';
      self.embeddedCheckoutActive = false;
      self.purchasing = false;
      self.render();
      return;
    }
    self.loadStripeJs(function () {
      self._stripe = self._stripe || window.Stripe(self.stripePublishableKey);
      var mountEl = self.root.querySelector('[data-checkout-mount]');
      if (!mountEl) return;
      self._stripe.initEmbeddedCheckout({
        clientSecret: clientSecret,
        onComplete: function () {
          self.embeddedCheckoutActive = false;
          self.rsvpDone = true; // reuse the same "done" state/messaging
          self.render();
        },
      }).then(function (checkout) {
        self._embeddedCheckout = checkout;
        checkout.mount(mountEl);
        self.purchasing = false;
      });
    });
  };

  // ── Render ─────────────────────────────────────────────────────────

  Widget.prototype.render = function () {
    var self = this;
    this.root.innerHTML = '';

    var wrap = el('div', { class: 't785-wrap' });
    this.root.appendChild(wrap);

    if (this.rsvpDone) {
      wrap.appendChild(el('div', { class: 't785-done' }, [
        el('span', { text: '✓', style: 'font-size:18px' }),
        el('div', {}, [
          el('div', { text: "You're going!", style: 'font-weight:600;color:#2d7a2d;font-size:14px' }),
          el('div', { text: 'Check your email for confirmation and details.', style: 'font-size:12px;color:#6b6560;margin-top:2px' }),
        ]),
      ]));
      return;
    }

    var lowestPrice = Math.min.apply(null, this.tiers.map(function (t) { return t.price; }));
    var headerLabel = this.isFreeEvent() ? 'Free Event' : 'Tickets';
    var headerPrice = this.isFreeEvent() ? 'Free' : 'From $' + lowestPrice.toFixed(2);
    var ctaLabel = this.isFreeEvent() ? 'RSVP' : 'Get Tickets';

    var header = el('div', { class: 't785-header', onclick: function () { self.expanded = !self.expanded; self.render(); } }, [
      el('div', { class: 't785-header-left' }, [
        el('span', { class: 't785-eyebrow', text: headerLabel }),
        el('span', { class: 't785-price' + (this.isFreeEvent() ? ' t785-price-free' : '') }, [
          document.createTextNode(headerPrice),
          !this.isFreeEvent() ? el('span', { class: 't785-price-note', text: '+ service fee' }) : null,
          this.tiers.length > 1 ? el('span', { class: 't785-price-note', text: '· ' + this.tiers.length + ' options' }) : null,
        ]),
      ]),
    ]);

    if (!this.expanded) {
      header.appendChild(el('button', {
        class: 't785-btn ' + (this.isFreeEvent() ? 'free' : 'paid'),
        text: ctaLabel,
        onclick: function (e) { e.stopPropagation(); self.expanded = true; self.render(); },
      }));
    } else {
      header.appendChild(el('span', { class: 't785-close', text: '✕ Close' }));
    }
    wrap.appendChild(header);

    if (!this.expanded) return;

    var body = el('div', { class: 't785-expand' });
    wrap.appendChild(body);

    if (this.embeddedCheckoutActive) {
      body.appendChild(el('div', { class: 't785-checkout-mount', 'data-checkout-mount': '1' }));
      body.appendChild(el('div', { class: 't785-badge', text: 'Payments secured by Stripe' }));
      return;
    }

    // Tier list
    var tiersWrap = el('div', { class: 't785-tiers' });
    this.tiers.forEach(function (tier) {
      var qty = self.cart[tier.id] || 0;
      var locked = self.tierLocked(tier) && qty === 0;
      var max = self.maxQtyFor(tier);
      var row = el('div', { class: 't785-tier' + (qty > 0 ? ' in-cart' : '') + (locked ? ' locked' : '') });

      var left = el('div', {}, [
        el('div', { class: 't785-tier-name', text: tier.name }),
        tier.description ? el('div', { class: 't785-tier-desc', text: tier.description }) : null,
        (tier.remaining !== null && tier.remaining <= 20) ? el('div', { class: 't785-tier-note', text: tier.remaining + ' remaining' }) : null,
      ]);

      var qtyCtrl = el('div', { class: 't785-qty' }, [
        el('button', {
          text: '−', disabled: locked || qty <= 0 ? 'disabled' : null,
          onclick: function () { if (!locked) self.setCart(tier.id, qty - 1); },
        }),
        el('span', { text: String(qty) }),
        el('button', {
          text: '+', disabled: locked || qty >= max ? 'disabled' : null,
          onclick: function () { if (!locked) self.setCart(tier.id, qty + 1); },
        }),
      ]);

      var right = el('div', { class: 't785-tier-right' }, [
        el('span', { class: 't785-tier-price', text: tier.price === 0 ? 'Free' : '$' + tier.price.toFixed(2) }),
        qtyCtrl,
      ]);

      row.appendChild(left);
      row.appendChild(right);
      tiersWrap.appendChild(row);
    });
    body.appendChild(tiersWrap);

    var anyLocked = this.tiers.some(function (t) { return self.tierLocked(t) && (self.cart[t.id] || 0) === 0; });
    if ((this.cartHasPaid() || this.cartHasFree()) && anyLocked) {
      body.appendChild(el('div', { class: 't785-lock-note', text: "Free and paid tickets can't be purchased together — checkout separately for the other." }));
    }

    // Pricing summary
    if (this.cartHasPaid() && this.cartEntries().length > 0) {
      var subtotalCents = 0, feeCents = 0;
      var summary = el('div', { class: 't785-summary' });
      this.cartEntries().forEach(function (e) {
        var unit = Math.round(e.tier.price * 100);
        var lineTotal = unit * e.qty;
        subtotalCents += lineTotal;
        feeCents += serviceFeeCents(unit) * e.qty;
        summary.appendChild(el('div', { class: 't785-summary-row' }, [
          el('span', { class: 't785-summary-label', text: e.qty + ' × ' + e.tier.name }),
          el('span', { text: fmt(lineTotal) }),
        ]));
      });
      summary.appendChild(el('div', { class: 't785-summary-row' }, [
        el('span', { class: 't785-summary-label', text: 'Service fee' }),
        el('span', { text: fmt(feeCents) }),
      ]));
      summary.appendChild(el('div', { class: 't785-summary-row t785-summary-total' }, [
        el('span', { text: 'Total' }),
        el('span', { text: fmt(subtotalCents + feeCents) }),
      ]));
      body.appendChild(summary);
    }

    // Purchaser info
    var guestSection = el('div', { class: 't785-section' });
    guestSection.appendChild(el('span', { class: 't785-section-title', text: 'Your Info (Purchaser)' }));
    guestSection.appendChild(makeField('Name', 'text', this.guestName, function (v) { self.guestName = v; self.syncFirstAttendeeName(); self.render(); }, 'First Last'));
    guestSection.appendChild(makeField('Email', 'email', this.guestEmail, function (v) { self.guestEmail = v; }, 'you@example.com', 'Your order confirmation and tickets will be sent here.'));
    guestSection.appendChild(makeField('Phone' + (this.cartHasPaid() ? '' : ' (optional)'), 'tel', this.guestPhone, function (v) { self.guestPhone = v; }, '(555) 123-4567', 'US numbers — country code added automatically.'));
    body.appendChild(guestSection);

    // Attendee blocks
    var slots = this.attendeeSlots();
    if (slots.length > 0) {
      var attSection = el('div', { class: 't785-section' });
      attSection.appendChild(el('span', { class: 't785-section-title', text: slots.length > 1 ? 'Attendee Details' : 'Attendee' }));
      slots.forEach(function (slot, i) {
        var card = el('div', { class: 't785-card' });
        if (slots.length > 1) {
          card.appendChild(el('div', { class: 't785-card-heading' }, [
            document.createTextNode('Attendee ' + (i + 1) + ' '),
            el('span', { text: '— ' + slot.tierName }),
          ]));
        }
        card.appendChild(makeField('Name', 'text', self.attendeeNames[slot.key] || '', function (v) {
          self.manuallyEditedNames[slot.key] = true;
          self.attendeeNames[slot.key] = v;
        }, 'First Last'));
        card.appendChild(makeField('Email (optional)', 'email', self.attendeeEmails[slot.key] || '', function (v) {
          self.attendeeEmails[slot.key] = v;
        }, 'attendee@example.com', "If this ticket isn't for you, add their email and we'll send them a copy directly."));

        self.questionsForTier(slot.tierId).forEach(function (q) {
          card.appendChild(makeQuestionField(q, self.attendeeAnswers[slot.key], function (val) {
            self.attendeeAnswers[slot.key] = self.attendeeAnswers[slot.key] || {};
            self.attendeeAnswers[slot.key][q.id] = val;
          }));
        });

        attSection.appendChild(card);
      });
      body.appendChild(attSection);
    }

    if (this.error) {
      body.appendChild(el('div', { class: 't785-error', text: this.error }));
    }

    var totalQty = this.totalQuantity();
    var confirmLabel = this.purchasing
      ? (this.cartHasPaid() ? 'Loading checkout…' : 'Saving your RSVP…')
      : totalQty === 0
        ? 'Select tickets above'
        : this.cartHasPaid()
          ? 'Continue to Payment · ' + fmt((function () {
              var s = 0, f = 0;
              self.cartEntries().forEach(function (e) {
                var unit = Math.round(e.tier.price * 100);
                s += unit * e.qty; f += serviceFeeCents(unit) * e.qty;
              });
              return s + f;
            })())
          : 'RSVP — ' + totalQty + ' Guest' + (totalQty > 1 ? 's' : '');

    body.appendChild(el('button', {
      class: 't785-confirm ' + (totalQty === 0 ? 'neutral' : this.cartHasPaid() ? 'paid' : 'free'),
      text: confirmLabel,
      disabled: this.purchasing || totalQty === 0 ? 'disabled' : null,
      onclick: function () { self.handleConfirm(); },
    }));
  };

  function makeField(label, type, value, onChange, placeholder, hint) {
    var row = el('div', { class: 't785-row' });
    row.appendChild(el('label', { class: 't785-label', text: label }));
    var input = el('input', { class: 't785-input', type: type, value: value, placeholder: placeholder || '' });
    input.addEventListener('input', function (e) { onChange(e.target.value); });
    row.appendChild(input);
    if (hint) row.appendChild(el('span', { class: 't785-hint', text: hint }));
    return row;
  }

  function makeQuestionField(q, answers, onChange) {
    var row = el('div', { class: 't785-row' });
    row.appendChild(el('label', { class: 't785-label', text: q.label + (q.is_required ? '' : ' (optional)') }));

    if (q.field_type === 'text') {
      var input = el('input', { class: 't785-input', type: 'text', value: (answers || {})[q.id] || '', placeholder: q.placeholder || '' });
      input.addEventListener('input', function (e) { onChange(e.target.value); });
      row.appendChild(input);
    } else if (q.field_type === 'select') {
      var select = el('select', { class: 't785-input' });
      select.appendChild(el('option', { value: '', text: 'Select…' }));
      (q.options || []).forEach(function (opt) {
        var o = el('option', { value: opt, text: opt });
        if ((answers || {})[q.id] === opt) o.setAttribute('selected', 'selected');
        select.appendChild(o);
      });
      select.addEventListener('change', function (e) { onChange(e.target.value); });
      row.appendChild(select);
    } else if (q.field_type === 'checkbox') {
      var wrap = el('label', { class: 't785-checkbox-row' });
      var cb = el('input', { type: 'checkbox' });
      cb.checked = (answers || {})[q.id] === 'Yes';
      cb.addEventListener('change', function (e) { onChange(e.target.checked ? 'Yes' : 'No'); });
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode('Yes'));
      row.appendChild(wrap);
    }
    return row;
  }

  function init() {
    var hosts = document.querySelectorAll('[data-785-event]');
    for (var i = 0; i < hosts.length; i++) mountWidget(hosts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
