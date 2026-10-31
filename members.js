(() => {
  const config = window.AARAMBH_SUPABASE || {};
  const authPanel = document.querySelector('#auth-panel');
  const workspace = document.querySelector('#member-workspace');
  const notice = document.querySelector('#app-notice');
  const authStatus = document.querySelector('#auth-status');
  const profileStatus = document.querySelector('#profile-status');
  const directoryStatus = document.querySelector('#directory-status');
  const profileForm = document.querySelector('#profile-form');
  const filterForm = document.querySelector('#filter-form');
  const results = document.querySelector('#member-results');
  const signOutButton = document.querySelector('#sign-out');
  let supabaseClient = null;
  let member = null;
  let currentProfile = null;

  const setStatus = (node, message, type = '') => {
    node.textContent = message || '';
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  };
  const escapeHtml = (value) => {
    const node = document.createElement('span');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  };
  const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const setValue = (form, name, value) => {
    const field = form.elements.namedItem(name);
    if (!field || value == null) return;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else if (Array.isArray(value)) field.value = value.join(', ');
    else field.value = value;
  };
  const formValue = (form, name) => form.elements.namedItem(name)?.value?.trim() || null;
  const intValue = (form, name) => {
    const value = formValue(form, name);
    return value === null ? null : Number.parseInt(value, 10);
  };

  document.querySelectorAll('[data-auth-view]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.authView;
      document.querySelectorAll('[data-auth-view]').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelector('#login-form').hidden = view !== 'login';
      document.querySelector('#signup-form').hidden = view !== 'register';
      document.querySelector('#recovery-form').hidden = true;
      setStatus(authStatus, '');
    });
  });

  document.querySelectorAll('.workspace-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      const panel = tab.dataset.panel;
      document.querySelectorAll('.workspace-tab').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.workspace-panel').forEach((item) => { item.hidden = item.id !== panel; });
      if (panel === 'directory-panel') await searchMembers();
    });
  });

  const setWorkspace = async (user) => {
    if (user && member?.id === user.id && !workspace.hidden) return;
    member = user;
    authPanel.hidden = Boolean(user);
    workspace.hidden = !user;
    signOutButton.hidden = !user;
    if (!user) {
      document.querySelector('#member-email').textContent = '';
      return;
    }
    document.querySelector('#member-email').textContent = user.email || 'Member';
    await loadMemberProfile();
  };

  const showSetupError = (message) => {
    notice.hidden = false;
    notice.textContent = message;
  };

  async function loadMemberProfile() {
    setStatus(profileStatus, 'Loading your profile…');
    const { data: profile, error } = await supabaseClient
      .from('member_profiles').select('*').eq('id', member.id).maybeSingle();
    if (error) {
      setStatus(profileStatus, '');
      showSetupError('The member database setup is not finished yet. The website code is ready, but the profile tables and access rules still need to be installed in Supabase.');
      console.error('Could not load member profile:', error.message);
      return;
    }
    currentProfile = profile;
    if (profile) {
      for (const [name, value] of Object.entries(profile)) setValue(profileForm, name, value);
      document.querySelector('#profile-state').textContent = profile.is_published ? 'Published to members' : 'Saved as a draft';
      document.querySelector('#profile-state').classList.toggle('published', Boolean(profile.is_published));
      document.querySelector('#unpublish-profile').hidden = !profile.is_published;
      await showProfilePhoto(profile.photo_path);
    } else {
      const params = new URLSearchParams(window.location.search);
      const forValue = params.get('for');
      const forSelect = profileForm.elements.namedItem('profile_for');
      if (forValue && forSelect && ['self', 'son_daughter', 'family_member'].includes(forValue)) forSelect.value = forValue;
      setStatus(profileStatus, 'Start your profile when you are ready.');
    }
    const { data: preferences, error: preferenceError } = await supabaseClient
      .from('member_preferences').select('*').eq('member_id', member.id).maybeSingle();
    if (preferenceError) {
      showSetupError('Your account is ready, but profile preferences could not be loaded. Please ask the site administrator to check the Supabase setup.');
      console.error('Could not load member preferences:', preferenceError.message);
      return;
    }
    if (preferences) {
      for (const [name, value] of Object.entries(preferences)) setValue(profileForm, name, value);
      fillSearchFilters(preferences);
    } else {
      fillSearchFilters({});
    }
    if (profile) {
      setStatus(profileStatus, profile.is_published
        ? 'Your profile is visible to signed-in Arambh members.'
        : 'Your profile is saved privately. Publish it when you are ready.');
    }
  }

  function fillSearchFilters(values) {
    setValue(filterForm, 'gender', values.preferred_gender || '');
    setValue(filterForm, 'min_age', values.min_age);
    setValue(filterForm, 'max_age', values.max_age);
    setValue(filterForm, 'min_height_cm', values.min_height_cm);
    setValue(filterForm, 'max_height_cm', values.max_height_cm);
    setValue(filterForm, 'religions', values.preferred_religions || []);
    setValue(filterForm, 'communities', values.preferred_communities || []);
    setValue(filterForm, 'locations', values.preferred_locations || []);
    setValue(filterForm, 'education', values.preferred_education || []);
  }

  async function showProfilePhoto(path) {
    const preview = document.querySelector('#photo-preview');
    if (!path) { preview.hidden = true; preview.removeAttribute('src'); return; }
    const { data, error } = await supabaseClient.storage.from('member-photos').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { preview.hidden = true; return; }
    preview.src = data.signedUrl;
    preview.hidden = false;
  }

  function readProfile() {
    return {
      id: member.id,
      profile_for: formValue(profileForm, 'profile_for'),
      display_name: formValue(profileForm, 'display_name'),
      gender: formValue(profileForm, 'gender'),
      date_of_birth: formValue(profileForm, 'date_of_birth'),
      height_cm: intValue(profileForm, 'height_cm'),
      marital_status: formValue(profileForm, 'marital_status'),
      mother_tongue: formValue(profileForm, 'mother_tongue'),
      religion: formValue(profileForm, 'religion'),
      community: formValue(profileForm, 'community'),
      show_religion: profileForm.elements.namedItem('show_religion').checked,
      show_community: profileForm.elements.namedItem('show_community').checked,
      city: formValue(profileForm, 'city'),
      country: formValue(profileForm, 'country'),
      education: formValue(profileForm, 'education'),
      occupation: formValue(profileForm, 'occupation'),
      phone_number: formValue(profileForm, 'phone_number'),
      about_me: formValue(profileForm, 'about_me'),
      personality: splitList(formValue(profileForm, 'personality')),
      family_background: formValue(profileForm, 'family_background'),
      partner_expectations: formValue(profileForm, 'partner_expectations'),
      publish_consent: profileForm.elements.namedItem('publish_consent').checked,
    };
  }

  function readPreferences() {
    return {
      member_id: member.id,
      preferred_gender: formValue(profileForm, 'preferred_gender'),
      min_age: intValue(profileForm, 'min_age') ?? 18,
      max_age: intValue(profileForm, 'max_age'),
      min_height_cm: intValue(profileForm, 'min_height_cm'),
      max_height_cm: intValue(profileForm, 'max_height_cm'),
      preferred_religions: splitList(formValue(profileForm, 'preferred_religions')),
      preferred_communities: splitList(formValue(profileForm, 'preferred_communities')),
      preferred_locations: splitList(formValue(profileForm, 'preferred_locations')),
      preferred_education: splitList(formValue(profileForm, 'preferred_education')),
    };
  }

  async function uploadPhoto() {
    const input = profileForm.elements.namedItem('photo');
    const file = input.files?.[0];
    if (!file) return currentProfile?.photo_path || null;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');
    }
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = member.id + '/' + crypto.randomUUID() + '.' + extension;
    const { error } = await supabaseClient.storage.from('member-photos').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    });
    if (error) throw error;
    input.value = '';
    return path;
  }

  async function saveProfile(publish, hide = false) {
    if (!profileForm.reportValidity()) return;
    if (publish && !profileForm.elements.namedItem('publish_consent').checked) {
      setStatus(profileStatus, 'Please agree to make the profile visible to signed-in members before publishing.', 'error');
      document.querySelector('#publish-consent').focus();
      return;
    }
    const save = document.querySelector('#profile-form button[type="submit"]');
    const publishButton = document.querySelector('#publish-profile');
    save.disabled = true;
    publishButton.disabled = true;
    setStatus(profileStatus, publish ? 'Publishing your profile…' : 'Saving your profile…');
    try {
      const photoPath = await uploadPhoto();
      const profile = readProfile();
      profile.photo_path = photoPath;
      profile.is_published = hide ? false : (publish ? true : (Boolean(currentProfile?.is_published) && profile.publish_consent));
      profile.published_at = profile.is_published ? (currentProfile?.published_at || new Date().toISOString()) : null;
      if (profile.is_published) profile.publish_consent = true;
      const { data, error } = await supabaseClient.from('member_profiles').upsert(profile, { onConflict: 'id' }).select().single();
      if (error) throw error;
      currentProfile = data;
      const preferences = readPreferences();
      const { error: preferenceError } = await supabaseClient.from('member_preferences').upsert(preferences, { onConflict: 'member_id' });
      if (preferenceError) throw preferenceError;
      document.querySelector('#profile-state').textContent = data.is_published ? 'Published to members' : 'Saved as a draft';
      document.querySelector('#profile-state').classList.toggle('published', Boolean(data.is_published));
      document.querySelector('#unpublish-profile').hidden = !data.is_published;
      await showProfilePhoto(data.photo_path);
      setStatus(profileStatus, data.is_published
        ? 'Your profile is now visible to signed-in Arambh members. Your contact details and exact birth date remain private.'
        : 'Your profile is saved privately. You can publish it whenever you are ready.', 'success');
    } catch (error) {
      console.error('Profile save failed:', error.message);
      setStatus(profileStatus, error.message || 'Your profile could not be saved. Please try again.', 'error');
    } finally {
      save.disabled = false;
      publishButton.disabled = false;
    }
  }

  function filterParameters(form = filterForm) {
    const list = (name) => splitList(formValue(form, name));
    return {
      p_gender: formValue(form, 'gender'),
      p_min_age: intValue(form, 'min_age'),
      p_max_age: intValue(form, 'max_age'),
      p_min_height: intValue(form, 'min_height_cm'),
      p_max_height: intValue(form, 'max_height_cm'),
      p_religions: list('religions'),
      p_communities: list('communities'),
      p_locations: list('locations'),
      p_education: list('education'),
      p_limit: 24,
      p_offset: 0,
    };
  }

  async function searchMembers() {
    results.innerHTML = '';
    setStatus(directoryStatus, 'Finding profiles…');
    const params = filterParameters();
    const { data, error } = await supabaseClient.rpc('search_members', params);
    if (error) {
      setStatus(directoryStatus, 'The member search is not ready. Please ask the site administrator to finish the Supabase setup.', 'error');
      console.error('Member search failed:', error.message);
      return;
    }
    if (!data?.length) {
      results.innerHTML = '<div class="member-empty"><b>No profiles match those filters yet.</b>Try widening the age, height or location range.</div>';
      setStatus(directoryStatus, 'No matching published profiles.');
      return;
    }
    const cards = await Promise.all(data.map(async (person) => {
      let photoUrl = '';
      if (person.photo_path) {
        const { data: signedPhoto } = await supabaseClient.storage.from('member-photos').createSignedUrl(person.photo_path, 3600);
        photoUrl = signedPhoto?.signedUrl || '';
      }
      const photo = photoUrl
        ? '<img class="member-card-photo" loading="lazy" alt="Profile photo" src="' + escapeHtml(photoUrl) + '">'
        : '<div class="member-card-photo placeholder" aria-hidden="true">♡</div>';
      const facts = [
        person.age ? escapeHtml(person.age + ' years') : '',
        person.height_cm ? escapeHtml(person.height_cm + ' cm') : '',
        person.marital_status ? escapeHtml(person.marital_status) : '',
        person.gender ? escapeHtml(person.gender) : '',
      ].filter(Boolean);
      const place = [person.city, person.country].filter(Boolean).map(escapeHtml).join(', ');
      const disclosures = [
        person.religion ? escapeHtml(person.religion) : '',
        person.community ? escapeHtml(person.community) : '',
      ].filter(Boolean);
      const tags = (person.personality || []).map((trait) => '<span>' + escapeHtml(trait) + '</span>').join('');
      return '<article class="member-card">' + photo + '<div class="member-card-body">' +
        '<span class="card-label">OPEN TO INTRODUCTIONS</span><h3>' + escapeHtml(person.display_name) + '</h3>' +
        '<div class="member-meta">' + place + (person.education ? ' · ' + escapeHtml(person.education) : '') + '</div>' +
        '<div class="member-facts">' + facts.map((fact) => '<span>' + fact + '</span>').join('') +
        disclosures.map((item) => '<span>' + item + '</span>').join('') + '</div>' +
        (person.occupation ? '<p><b>Work:</b> ' + escapeHtml(person.occupation) + '</p>' : '') +
        (person.about_me ? '<p>' + escapeHtml(person.about_me) + '</p>' : '') +
        (tags ? '<div class="member-facts">' + tags + '</div>' : '') +
        (person.partner_expectations ? '<p class="card-label">HOPING TO FIND</p><p>' + escapeHtml(person.partner_expectations) + '</p>' : '') +
        '</div></article>';
    }));
    results.innerHTML = cards.join('');
    setStatus(directoryStatus, data.length + (data.length === 24 ? '+ profiles' : ' profiles found'));
  }

  async function saveFilterPreferences() {
    const p = filterParameters();
    const preferences = {
      member_id: member.id,
      preferred_gender: p.p_gender,
      min_age: p.p_min_age ?? 18,
      max_age: p.p_max_age,
      min_height_cm: p.p_min_height,
      max_height_cm: p.p_max_height,
      preferred_religions: p.p_religions,
      preferred_communities: p.p_communities,
      preferred_locations: p.p_locations,
      preferred_education: p.p_education,
    };
    const { error } = await supabaseClient.from('member_preferences').upsert(preferences, { onConflict: 'member_id' });
    if (error) { setStatus(directoryStatus, 'Could not save these preferences.', 'error'); return; }
    for (const [name, value] of Object.entries(preferences)) setValue(profileForm, name, value);
    setStatus(directoryStatus, 'Saved as your match preferences.', 'success');
  }

  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(authStatus, 'Signing in…');
    const form = event.currentTarget;
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: form.elements.email.value.trim(), password: form.elements.password.value,
    });
    if (error) { setStatus(authStatus, error.message, 'error'); return; }
    form.reset();
    await setWorkspace(data.user);
  });

  document.querySelector('#signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(authStatus, 'Creating your account…');
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const { data, error } = await supabaseClient.auth.signUp({
      email, password: form.elements.password.value,
      options: { emailRedirectTo: new URL('members.html', window.location.href).href },
    });
    if (error) { setStatus(authStatus, error.message, 'error'); return; }
    form.reset();
    if (data.session && data.user) await setWorkspace(data.user);
    else setStatus(authStatus, 'Check your email to confirm your account, then return here to log in.', 'success');
  });

  document.querySelector('#recovery-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, error } = await supabaseClient.auth.updateUser({ password: form.elements.password.value });
    if (error) { setStatus(authStatus, error.message, 'error'); return; }
    form.reset();
    setStatus(authStatus, 'Password updated.', 'success');
    if (data.user) await setWorkspace(data.user);
  });

  document.querySelector('#reset-password').addEventListener('click', async () => {
    const email = document.querySelector('#login-email').value.trim();
    if (!email) { setStatus(authStatus, 'Enter your email address first.'); return; }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('members.html', window.location.href).href,
    });
    setStatus(authStatus, error ? error.message : 'Password reset instructions have been sent to your email.', error ? 'error' : 'success');
  });

  signOutButton.addEventListener('click', async () => {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) { showSetupError(error.message); return; }
    currentProfile = null;
    setWorkspace(null);
  });

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveProfile(false);
  });
  document.querySelector('#publish-profile').addEventListener('click', () => saveProfile(true));
  document.querySelector('#unpublish-profile').addEventListener('click', async () => {
    if (!currentProfile) return;
    await saveProfile(false, true);
  });

  document.querySelector('#profile-photo').addEventListener('change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      event.currentTarget.value = '';
      setStatus(profileStatus, 'Choose a JPG, PNG or WebP image under 5 MB.', 'error');
      return;
    }
    const preview = document.querySelector('#photo-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  filterForm.addEventListener('submit', async (event) => { event.preventDefault(); await searchMembers(); });
  document.querySelector('#reset-filters').addEventListener('click', async () => { filterForm.reset(); await searchMembers(); });
  document.querySelector('#save-filter-preferences').addEventListener('click', saveFilterPreferences);

  const birthDate = document.querySelector('#birth-date');
  const adultDate = new Date();
  adultDate.setFullYear(adultDate.getFullYear() - 18);
  birthDate.max = adultDate.toISOString().slice(0, 10);

  if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
    showSetupError('Member access is not connected. Please check the Arambh Supabase URL, publishable key and client library.');
    document.querySelectorAll('#login-form input,#signup-form input,#login-form button,#signup-form button').forEach((field) => { field.disabled = true; });
  } else {
    supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
    supabaseClient.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') {
          member = session?.user || null;
          authPanel.hidden = false;
          workspace.hidden = true;
          signOutButton.hidden = true;
          document.querySelector('#login-form').hidden = true;
          document.querySelector('#signup-form').hidden = true;
          document.querySelector('#recovery-form').hidden = false;
          setStatus(authStatus, 'Choose a new password for your Arambh account.');
          return;
        }
        setWorkspace(session?.user || null).catch((error) => {
          console.error('Could not open member space:', error.message);
          showSetupError('Could not load the member space. Please refresh and try again.');
        });
      }, 0);
    });
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) showSetupError(error.message);
      else setWorkspace(data.session?.user || null);
    });
  }
})();