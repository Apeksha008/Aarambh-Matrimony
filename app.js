const loginModal = document.querySelector('#login-modal');
document.querySelector('[data-login]').addEventListener('click', () => loginModal.showModal());
document.querySelector('.modal-close').addEventListener('click', () => loginModal.close());
loginModal.addEventListener('click', (event) => { if (event.target === loginModal) loginModal.close(); });
loginModal.querySelector('a').addEventListener('click', () => loginModal.close());

const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}));

const form = document.querySelector('#join-form');
const notice = form.querySelector('.demo-notice');
const connectionStatus = form.querySelector('#connection-status');
const supabaseConfig = window.AARAMBH_SUPABASE || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
const hasSupabaseLibrary = Boolean(window.supabase?.createClient);
const supabaseReady = hasSupabaseConfig && hasSupabaseLibrary;
const supabaseClient = supabaseReady
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

if (supabaseReady) {
  connectionStatus.classList.add('is-connected');
  connectionStatus.querySelector('span:last-child').textContent = 'Website is connected to the Arambh database';
  notice.textContent = 'Your details will be sent to Arambh when you submit this form.';
} else if (hasSupabaseConfig) {
  connectionStatus.classList.add('is-error');
  connectionStatus.querySelector('span:last-child').textContent = 'Not connected — Supabase could not load';
  notice.textContent = 'This preview is not sending details online yet.';
} else {
  connectionStatus.classList.add('is-preview');
  connectionStatus.querySelector('span:last-child').textContent = 'Preview only — not connected to a database';
  notice.textContent = 'Preview mode: entries stay in this browser and are not sent online.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('.submit');
  submit.disabled = true;
  status.textContent = supabaseReady ? 'Sending your details…' : 'Saving preview entry…';
  try {
    const entry = {
      name: data.name.trim(),
      email: data.email.trim(),
      location: data.location.trim(),
      profile_for: data.profile_for,
      consent: true,
    };
    if (supabaseClient) {
      const { error } = await supabaseClient.from('launch_interest').insert(entry);
      if (error) throw error;
      status.textContent = `Thank you, ${data.name.trim().split(/\s+/)[0]}. You’re on the Arambh early-access list.`;
      connectionStatus.querySelector('span:last-child').textContent = 'Confirmed — your entry reached the Arambh database';
    } else if (!hasSupabaseConfig) {
      const list = JSON.parse(localStorage.getItem('aarambh-early-list') || '[]');
      list.push({ ...entry, created_at: new Date().toISOString() });
      localStorage.setItem('aarambh-early-list', JSON.stringify(list));
      status.textContent = `Thank you, ${data.name.trim().split(/\s+/)[0]}. Your preview entry is saved in this browser.`;
    } else {
      throw new Error('Supabase client library did not load');
    }
    form.reset();
  } catch (error) {
    console.error('Arambh early-access submission failed:', error);
    if (supabaseReady) {
      connectionStatus.classList.remove('is-connected');
      connectionStatus.classList.add('is-error');
      connectionStatus.querySelector('span:last-child').textContent = 'Could not save to database — check the connection';
    }
    status.textContent = supabaseReady
      ? 'We could not submit your details. Please check the setup or try again later.'
      : 'This browser could not save the preview entry. Please try again.';
  } finally {
    submit.disabled = false;
  }
});

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else revealItems.forEach((item) => item.classList.add('visible'));
