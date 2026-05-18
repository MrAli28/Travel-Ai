/* TravelAI — Main JavaScript */

(function () {
  'use strict';

  // --- Year ---
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
      });
      
      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // --- Search Functionality ---
  const searchInputs = document.querySelectorAll('input[placeholder*="Search"]');
  searchInputs.forEach(input => {
    input.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        const query = this.value.toLowerCase();
        alert('Searching for: ' + query + '\n(Search logic integrated!)');
        // Yahan hum filtering logic mazeed extend kar saktay hain
      }
    });
  });


  // --- Mobile Nav Toggle ---
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel = document.querySelector('[data-nav-panel]');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var isOpen = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    panel.addEventListener('click', function (e) {
      if (e.target && e.target.matches && e.target.matches('a.nav-link')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Preference Toggle ---
  var prefGrid = document.querySelector('[data-pref-grid]');
  if (prefGrid) {
    var prefBtns = prefGrid.querySelectorAll('.pref-btn');
    prefBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.classList.toggle('selected');
      });
    });
  }

  // --- Testimonials Slider ---
  var tRoot = document.querySelector('[data-testimonials]');
  if (tRoot) {
    var tViewport = tRoot.querySelector('[data-testimonials-viewport]');
    var tNext = tRoot.querySelector('[data-testimonials-next]');
    var tPrev = tRoot.querySelector('[data-testimonials-prev]');
    var tTrack = tRoot.querySelector('[data-testimonials-track]');

    function getStepSize() {
      if (!tTrack) return 0;
      var first = tTrack.querySelector('.testimonial-card');
      if (!first) return 0;

      var style = window.getComputedStyle(tTrack);
      var gap = parseFloat(style.columnGap || style.gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function scrollNextOne() {
      if (!tViewport) return;
      var step = getStepSize();
      if (!step) return;

      var maxScroll = tViewport.scrollWidth - tViewport.clientWidth;
      var nextLeft = tViewport.scrollLeft + step;

      if (nextLeft >= (maxScroll - 2)) {
        tViewport.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }

      tViewport.scrollBy({ left: step, behavior: 'smooth' });
    }

    function scrollPrevOne() {
      if (!tViewport) return;
      var step = getStepSize();
      if (!step) return;

      var currentLeft = tViewport.scrollLeft;
      if (currentLeft <= 2) {
        var maxScroll = tViewport.scrollWidth - tViewport.clientWidth;
        tViewport.scrollTo({ left: maxScroll, behavior: 'smooth' });
        return;
      }

      tViewport.scrollBy({ left: -step, behavior: 'smooth' });
    }

    if (tNext) tNext.addEventListener('click', scrollNextOne);
    if (tPrev) tPrev.addEventListener('click', scrollPrevOne);
  }

  // --- Destination Modal ---
  var destModal = document.querySelector('[data-dest-modal]');
  var destModalClose = document.querySelector('[data-dest-modal-close]');
  var viewDetailBtns = document.querySelectorAll('[data-view-details]');

  if (destModal && destModalClose) {
    var modalImg = destModal.querySelector('[data-modal-img]');
    var modalTitle = destModal.querySelector('[data-modal-title]');
    var modalDesc = destModal.querySelector('[data-modal-desc]');
    var modalPrice = destModal.querySelector('[data-modal-price]');
    var modalAttractions = destModal.querySelector('[data-modal-attractions]');
    var modalItinerary = destModal.querySelector('[data-modal-itinerary]');
    var modalReviews = destModal.querySelector('[data-modal-reviews]');

    // Delegate click events to the grid and popular row to handle modal opening
    var contentContainers = document.querySelectorAll('[data-dest-grid], [data-popular-row]');
    contentContainers.forEach(function (container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-view-details]');
        if (!btn) return;

        e.preventDefault();
        var title = btn.getAttribute('data-title');
        var desc = btn.getAttribute('data-desc');
        var img = btn.getAttribute('data-img');
        var price = btn.getAttribute('data-price') || '$999';
        var attractions = (btn.getAttribute('data-attractions') || '').split(',');
        var itinerary = (btn.getAttribute('data-itinerary') || '').split('|');

        if (modalImg) modalImg.src = img;
        if (modalTitle) modalTitle.textContent = title;
        if (modalDesc) modalDesc.textContent = desc;
        if (modalPrice) modalPrice.textContent = price;

        if (modalAttractions) {
          modalAttractions.innerHTML = '';
          attractions.forEach(function (item) {
            if (!item.trim()) return;
            var li = document.createElement('li');
            li.textContent = item.trim();
            modalAttractions.appendChild(li);
          });
        }

        if (modalItinerary) {
          modalItinerary.innerHTML = '';
          itinerary.forEach(function (step) {
            if (!step.trim()) return;
            var parts = step.split(':');
            var day = parts[0] ? parts[0].trim() : 'Day';
            var text = parts[1] ? parts[1].trim() : step;
            var li = document.createElement('li');
            li.className = 'itinerary-item';
            li.innerHTML = '<span class="itinerary-day">' + day + '</span><span class="itinerary-text">' + text + '</span>';
            modalItinerary.appendChild(li);
          });
        }

        if (modalReviews) {
          modalReviews.innerHTML = '<div class="review-card"><div class="review-top"><span class="review-user">John Doe</span><span class="review-rating">★★★★★</span></div><p>Amazing experience! The guide was very helpful.</p></div>' +
                                   '<div class="review-card"><div class="review-top"><span class="review-user">Sarah W.</span><span class="review-rating">★★★★☆</span></div><p>Beautiful scenery, but a bit crowded during weekends.</p></div>';
        }

        // Reset to first tab
        var tabBtns = destModal.querySelectorAll('.modal-tab-btn');
        var tabPanes = destModal.querySelectorAll('.modal-tab-content');
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        tabPanes.forEach(function (p) { p.classList.remove('active'); });
        if (tabBtns[0]) tabBtns[0].classList.add('active');
        if (tabPanes[0]) tabPanes[0].classList.add('active');

        destModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    });

    // Tab Logic
    var tabBtns = destModal.querySelectorAll('.modal-tab-btn');
    var tabPanes = destModal.querySelectorAll('.modal-tab-content');

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        tabPanes.forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        destModal.querySelector('[data-tab-pane="' + target + '"]').classList.add('active');
      });
    });

    function closeDestModal() {
      destModal.classList.remove('is-open');
      document.body.style.overflow = ''; // Restore scrolling
    }

    destModalClose.addEventListener('click', closeDestModal);
    destModal.addEventListener('click', function (e) {
      if (e.target === destModal) closeDestModal();
    });
  }

  // --- Destinations Filter ---
  var destFilter = document.querySelector('[data-dest-filter]');
  var destGrid = document.querySelector('[data-dest-grid]');
  if (destFilter && destGrid) {
    var filterBtns = destFilter.querySelectorAll('[data-filter]');

    function applyFilter(value) {
      var cards = destGrid.querySelectorAll('[data-category]');
      cards.forEach(function (card) {
        var cat = card.getAttribute('data-category') || '';
        var show = value === 'all' || cat === value;
        card.style.display = show ? '' : 'none';
      });
    }

    destFilter.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!btn) return;
      var value = btn.getAttribute('data-filter') || 'all';

      filterBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      applyFilter(value);
    });
  }

  // --- Scroll Reveal Animations ---
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls && revealEls.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  // --- Chatbot ---
  var chatOpen = document.querySelector('[data-chat-open]');
  var chat = document.querySelector('[data-chat]');
  var chatClose = document.querySelector('[data-chat-close]');
  var chatBody = document.querySelector('[data-chat-body]');
  var chatForm = document.querySelector('[data-chat-form]');
  var chatInput = document.querySelector('[data-chat-input]');
  var suggestionsRoot = document.querySelector('[data-chat-suggestions]');

  function addMessage(sender, text) {
    var msg = document.createElement('div');
    msg.className = 'msg ' + sender;

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    if (sender === 'bot') {
      avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';
    } else {
      avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    }

    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function openChat() {
    if (chat) chat.classList.add('is-open');
    if (chatOpen) chatOpen.classList.add('hidden');
    if (chatBody && chatBody.children.length === 0) {
      addMessage('bot', "Hello! 👋 I'm your AI travel assistant. How can I help you plan your perfect trip today?");
    }
  }

  function closeChat() {
    if (chat) chat.classList.remove('is-open');
    if (chatOpen) chatOpen.classList.remove('hidden');
  }

  if (chatOpen) chatOpen.addEventListener('click', openChat);
  if (chatClose) chatClose.addEventListener('click', closeChat);

  if (suggestionsRoot) {
    suggestionsRoot.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip && chatInput) {
        chatInput.value = chip.textContent;
        chatInput.focus();
      }
    });
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = chatInput.value.trim();
      if (!text) return;

      addMessage('user', text);
      chatInput.value = '';
      if (suggestionsRoot) suggestionsRoot.style.display = 'none';

      // Typing indicator
      var typingId = 'typing-' + Date.now();
      var typingEl = document.createElement('div');
      typingEl.className = 'msg bot';
      typingEl.id = typingId;
      typingEl.innerHTML = '<div class="msg-avatar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>'
        + '<div class="msg-bubble" style="opacity:.6">✦ Thinking…</div>';
      if (chatBody) { chatBody.appendChild(typingEl); chatBody.scrollTop = chatBody.scrollHeight; }

      try {
        if (typeof CONFIG === 'undefined' || !CONFIG.GEMINI_KEY) throw new Error('Config not loaded');

        var prompt = 'You are TravelAI, a friendly expert travel assistant. '
          + 'Answer concisely (2-4 sentences max) in a helpful, upbeat tone. '
          + 'If the user mentions a specific city or destination, end your reply with: '
          + '"👉 Want a full itinerary? [Open AI Planner](itinerary.html?city=CITYNAME)" '
          + 'replacing CITYNAME with the actual city name (URL-encoded, no spaces). '
          + 'User message: ' + text;

        var res = await fetch(CONFIG.GROQ_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CONFIG.GROQ_KEY
          },
          body: JSON.stringify({
            model: CONFIG.GROQ_MODEL,
            messages: [
              { role: 'system', content: 'You are TravelAI, a friendly expert travel assistant. Answer concisely (2-4 sentences max) in a helpful, upbeat tone. If the user mentions a specific city, end with: "👉 [Open AI Planner](itinerary.html?city=CITYNAME)" replacing CITYNAME with the URL-encoded city.' },
              { role: 'user', content: text }
            ],
            temperature: 0.8,
            max_tokens: 300
          })
        });

        var data = await res.json();
        var reply = data.choices[0].message.content || 'I could not generate a response. Please try again.';

        // Remove typing indicator
        var typEl = document.getElementById(typingId);
        if (typEl) typEl.remove();

        // Check for planner link in reply
        var plannerMatch = reply.match(/\[Open AI Planner\]\((itinerary\.html[^\)]*)\)/);
        var cleanReply   = reply.replace(/\[Open AI Planner\]\([^\)]*\)/g, '').trim();

        addMessage('bot', cleanReply);

        // Add planner button if applicable
        if (plannerMatch) {
          var linkEl = document.createElement('div');
          linkEl.className = 'msg bot';
          linkEl.innerHTML = '<div class="msg-avatar"></div>'
            + '<div class="msg-bubble" style="padding:0">'
            + '<a href="' + plannerMatch[1] + '" style="display:flex;align-items:center;gap:.4rem;padding:.5rem .8rem;'
            + 'background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:.82rem">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>'
            + '✨ Open Full AI Planner</a></div>';
          if (chatBody) { chatBody.appendChild(linkEl); chatBody.scrollTop = chatBody.scrollHeight; }
        }

      } catch (err) {
        var typEl2 = document.getElementById(typingId);
        if (typEl2) typEl2.remove();
        addMessage('bot', 'Sorry, I had trouble connecting to AI. Please check your internet connection and try again.');
      }
    });
  }
})();
