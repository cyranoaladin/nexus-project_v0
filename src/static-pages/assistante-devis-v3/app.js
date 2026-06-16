/**
 * ============================================
 * NEXUS RÉUSSITE — ASSISTANT DEVIS V3 PREMIUM
 * JavaScript Application
 * ============================================
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const CONFIG = {
  totalSteps: 5,
  storageKey: 'nexus_assistante_v3_data',
  themeKey: 'nexus_assistante_v3_theme',
  offersUrl: '/dashboard/assistante/devis/assets/offres-nexus.json',
  autoSaveDelay: 1000,
  validationPatterns: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+216[\s.]?[0-9]{2}[\s.]?[0-9]{3}[\s.]?[0-9]{3}$/
  }
};

// Current state
let currentStep = 1;
let formData = {};
let autoSaveTimeout = null;
let OFFERS = {};
let offersLoadPromise = null;
let currentRecommendation = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  initializeApp().catch(error => {
    console.error('Erreur initialisation assistant devis:', error);
    showNotification('Impossible de charger les offres Nexus synchronisées', 'error');
  });
});

async function initializeApp() {
  // Load saved theme
  loadTheme();

  await loadCanonicalOffers();

  // Initialize event listeners
  initializeEventListeners();

  // Load saved form data after fields are available
  loadFromLocalStorage();
  updateDynamicFields();
  
  // Update UI
  updateWizardUI();
  updateProgressBar();
  
  console.log('🎓 Nexus Assistante V3 — Initialisé avec succès');
}

// ============================================
// WIZARD NAVIGATION
// ============================================

/**
 * Navigate to the next step
 */
function nextStep() {
  if (currentStep < CONFIG.totalSteps) {
    // Validate current step before proceeding
    if (validateStep(currentStep)) {
      currentStep++;
      goToStep(currentStep);
    }
  }
}

/**
 * Navigate to the previous step
 */
function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    goToStep(currentStep);
  }
}

/**
 * Navigate to a specific step
 * @param {number} step - Step number (1-5)
 */
function goToStep(step) {
  if (step < 1 || step > CONFIG.totalSteps) return;
  
  // Validate previous steps if going forward
  if (step > currentStep) {
    for (let i = currentStep; i < step; i++) {
      if (!validateStep(i)) {
        return; // Stop if validation fails
      }
    }
  }
  
  currentStep = step;
  updateWizardUI();
  updateProgressBar();
  updateStepIndicators();
  
  // Scroll to top of form
  document.getElementById('wizardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Auto-save on step change
  autoSave();
}

/**
 * Update wizard UI - show/hide steps
 */
function updateWizardUI() {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach((step, index) => {
    step.classList.add('hidden');
    step.setAttribute('aria-hidden', 'true');
  });
  
  // Show current step
  const currentStepEl = document.getElementById(`step-${currentStep}`);
  if (currentStepEl) {
    currentStepEl.classList.remove('hidden');
    currentStepEl.setAttribute('aria-hidden', 'false');
    currentStepEl.classList.add('animate-fade-in');
  }
  
  // Update step indicators
  updateStepIndicators();
}

/**
 * Update step indicator buttons
 */
function updateStepIndicators() {
  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    const stepNum = index + 1;
    const btn = indicator.querySelector('.step-btn');
    
    // Remove all state classes
    btn.classList.remove('active', 'completed', 'pending', 'bg-nexus-gold', 'text-white', 'shadow-gold');
    btn.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400');
    
    if (stepNum === currentStep) {
      // Current step
      btn.classList.add('active', 'bg-nexus-gold', 'text-white', 'shadow-gold');
      btn.setAttribute('aria-selected', 'true');
      btn.removeAttribute('tabindex');
      indicator.classList.add('active');
    } else if (stepNum < currentStep) {
      // Completed step
      btn.classList.add('completed', 'bg-nexus-gold', 'text-white');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
      indicator.classList.add('completed');
      
      // Change number to checkmark
      btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
    } else {
      // Pending step
      btn.classList.add('pending', 'bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
      indicator.classList.remove('active', 'completed');
      
      // Restore step number
      btn.textContent = stepNum;
    }
  });
}

/**
 * Update progress bar
 */
function updateProgressBar() {
  const progress = ((currentStep - 1) / (CONFIG.totalSteps - 1)) * 100;
  const progressBar = document.getElementById('progressBar');
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', Math.round(progress));
  }
}

// ============================================
// STEP VALIDATION
// ============================================

/**
 * Validate a specific step
 * @param {number} step - Step number to validate
 * @returns {boolean} - Validation result
 */
function validateStep(step) {
  const stepEl = document.getElementById(`step-${step}`);
  if (!stepEl) return true;
  
  const requiredFields = stepEl.querySelectorAll('[required]');
  let isValid = true;
  
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      isValid = false;
      markFieldInvalid(field, 'Ce champ est obligatoire');
    } else {
      markFieldValid(field);
    }
  });
  
  // Step-specific validations
  switch (step) {
    case 1:
      // Validate email and phone
      const email = document.getElementById('email');
      const phone = document.getElementById('whatsapp');
      
      if (email && email.value && !validateEmailField(email)) {
        isValid = false;
      }
      if (phone && phone.value && !validatePhoneField(phone)) {
        isValid = false;
      }
      break;
      
    case 2:
      // Validate level and status selection
      const level = document.getElementById('level');
      const status = document.getElementById('status');
      
      if (level && !level.value) {
        isValid = false;
        markFieldInvalid(level, 'Veuillez sélectionner un niveau');
      }
      if (status && !status.value) {
        isValid = false;
        markFieldInvalid(status, 'Veuillez sélectionner un statut');
      }
      break;
  }
  
  if (!isValid) {
    // Shake animation for visual feedback
    stepEl.classList.add('animate-shake');
    setTimeout(() => stepEl.classList.remove('animate-shake'), 400);
    
    // Show validation message
    showNotification('Veuillez remplir tous les champs obligatoires', 'error');
  }
  
  return isValid;
}

/**
 * Mark field as invalid with message
 */
function markFieldInvalid(field, message) {
  field.classList.add('input-invalid');
  field.classList.remove('input-valid');
  field.setAttribute('aria-invalid', 'true');
  
  // Find or create validation message element
  let validationEl = field.parentElement.querySelector('.validation-message');
  if (!validationEl) {
    validationEl = document.createElement('p');
    validationEl.className = 'validation-message error';
    field.parentElement.appendChild(validationEl);
  }
  
  validationEl.innerHTML = `<i class="fas fa-exclamation-circle" aria-hidden="true"></i> ${message}`;
  validationEl.style.display = 'flex';
}

/**
 * Mark field as valid
 */
function markFieldValid(field) {
  field.classList.remove('input-invalid');
  field.classList.add('input-valid');
  field.setAttribute('aria-invalid', 'false');
  
  const validationEl = field.parentElement.querySelector('.validation-message');
  if (validationEl) {
    validationEl.style.display = 'none';
  }
}

// ============================================
// FIELD VALIDATIONS
// ============================================

/**
 * Validate email field
 */
function validateEmail(field) {
  validateEmailField(field);
  autoSave();
}

function validateEmailField(field) {
  const value = field.value.trim();
  
  if (!value) {
    markFieldInvalid(field, 'L\'email est obligatoire');
    return false;
  }
  
  if (!CONFIG.validationPatterns.email.test(value)) {
    markFieldInvalid(field, 'Veuillez entrer un email valide');
    return false;
  }
  
  markFieldValid(field);
  return true;
}

/**
 * Validate phone field
 */
function validatePhone(field) {
  validatePhoneField(field);
  autoSave();
}

function validatePhoneField(field) {
  const value = field.value.trim();
  
  if (!value) {
    markFieldInvalid(field, 'Le numéro WhatsApp est obligatoire');
    return false;
  }
  
  // Normalize phone number
  const normalized = value.replace(/[\s.]/g, '');
  
  if (!CONFIG.validationPatterns.phone.test(normalized)) {
    markFieldInvalid(field, 'Format: +216 XX XXX XXX');
    return false;
  }
  
  markFieldValid(field);
  return true;
}

// ============================================
// DYNAMIC FIELDS
// ============================================

/**
 * Update dynamic fields based on level and status
 */
function updateDynamicFields() {
  const level = document.getElementById('level')?.value;
  const status = document.getElementById('status')?.value;

  document.querySelectorAll('.dynamic-field').forEach(field => {
    let visible = true;
    const levels = field.dataset.showIfLevel;
    const condition = field.dataset.showIf;

    if (levels) {
      visible = visible && levels.split(',').includes(level || '');
    }

    if (condition) {
      const [fieldName, rawValues] = condition.split(':');
      const allowed = (rawValues || '').split(',');
      const currentValue = fieldName === 'status' ? status : document.getElementById(fieldName)?.value;
      visible = visible && allowed.includes(currentValue || '');
    }

    field.classList.toggle('hidden', !visible);
    field.querySelectorAll('input, select, textarea').forEach(input => {
      input.disabled = !visible;
    });
  });
}

// ============================================
// LOCAL STORAGE (AUTO-SAVE)
// ============================================

/**
 * Auto-save form data to localStorage
 */
function autoSave() {
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Show saving indicator
  showSaveIndicator('saving');
  
  // Set new timeout
  autoSaveTimeout = setTimeout(() => {
    saveToLocalStorage();
    showSaveIndicator('saved');
  }, CONFIG.autoSaveDelay);
}

/**
 * Save form data to localStorage
 */
function saveToLocalStorage() {
  const form = document.getElementById('wizardForm');
  if (!form) return;
  
  // Collect all form data
  const data = {
    currentStep: currentStep,
    timestamp: new Date().toISOString(),
    fields: {}
  };
  
  // Get all input values
  form.querySelectorAll('input, select, textarea').forEach(field => {
    if (field.name) {
      if (field.type === 'checkbox') {
        if (!data.fields[field.name]) data.fields[field.name] = [];
        if (field.checked) data.fields[field.name].push(field.value || true);
      } else if (field.type === 'radio') {
        if (field.checked) {
          data.fields[field.name] = field.value;
        }
      } else {
        data.fields[field.name] = field.value;
      }
    }
  });
  
  // Get specialites (checkboxes)
  const specialites = [];
  form.querySelectorAll('input[name="specialites"]:checked').forEach(cb => {
    specialites.push(cb.value);
  });
  if (specialites.length > 0) {
    data.fields.specialites = specialites;
  }
  
  // Save to localStorage
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage non disponible:', e);
  }
}

/**
 * Load form data from localStorage
 */
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKey);
    if (!saved) return;
    
    const data = JSON.parse(saved);
    
    // Restore current step
    if (data.currentStep) {
      currentStep = data.currentStep;
    }
    
    // Restore form fields
    if (data.fields) {
      Object.entries(data.fields).forEach(([name, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => {
            const cb = document.querySelector(`[name="${name}"][value="${item}"]`);
            if (cb) cb.checked = true;
          });
          return;
        }

        const field = document.querySelector(`[name="${name}"]`);
        
        if (field) {
          if (field.type === 'checkbox') {
            field.checked = value;
          } else if (field.type === 'radio') {
            const radio = document.querySelector(`[name="${name}"][value="${value}"]`);
            if (radio) radio.checked = true;
          } else {
            field.value = value;
          }
        }
      });
      
      // Restore specialites checkboxes
      if (data.fields.specialites && Array.isArray(data.fields.specialites)) {
        data.fields.specialites.forEach(spe => {
          const cb = document.querySelector(`input[name="specialites"][value="${spe}"]`);
          if (cb) cb.checked = true;
        });
      }
    }
    
    console.log('📥 Données chargées depuis le stockage local');
  } catch (e) {
    console.warn('Erreur lors du chargement:', e);
  }
}

/**
 * Show save indicator
 */
function showSaveIndicator(state) {
  const indicator = document.getElementById('saveIndicator');
  if (!indicator) return;
  
  indicator.classList.remove('opacity-0');
  indicator.classList.remove('saving');
  
  if (state === 'saving') {
    indicator.classList.add('saving');
    indicator.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> <span>Sauvegarde...</span>';
  } else if (state === 'saved') {
    indicator.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> <span>Sauvegardé</span>';
    
    // Hide after 2 seconds
    setTimeout(() => {
      indicator.classList.add('opacity-0');
    }, 2000);
  }
}

// ============================================
// THEME MANAGEMENT
// ============================================

/**
 * Toggle dark/light mode
 */
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  
  // Save preference
  try {
    localStorage.setItem(CONFIG.themeKey, isDark ? 'dark' : 'light');
  } catch (e) {
    console.warn('Impossible de sauvegarder le thème:', e);
  }
  
  // Update icon
  updateThemeIcon(isDark);
}

/**
 * Load saved theme
 */
function loadTheme() {
  try {
    const savedTheme = localStorage.getItem(CONFIG.themeKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    updateThemeIcon(isDark);
  } catch (e) {
    console.warn('Erreur lors du chargement du thème:', e);
  }
}

/**
 * Update theme toggle icon
 */
function updateThemeIcon(isDark) {
  // Handled by CSS classes in HTML
}

// ============================================
// FORM RESET
// ============================================

/**
 * Reset the entire form
 */
function resetForm() {
  if (!confirm('Voulez-vous vraiment réinitialiser le formulaire ? Toutes les données saisies seront perdues.')) {
    return;
  }
  
  // Reset form
  const form = document.getElementById('wizardForm');
  if (form) {
    form.reset();
  }
  
  // Clear localStorage
  try {
    localStorage.removeItem(CONFIG.storageKey);
  } catch (e) {
    console.warn('Impossible de supprimer les données:', e);
  }
  
  // Reset state
  currentStep = 1;
  formData = {};
  
  // Update UI
  updateWizardUI();
  updateProgressBar();
  updateStepIndicators();
  
  updateDynamicFields();
  
  // Clear validation states
  document.querySelectorAll('.input-valid, .input-invalid').forEach(field => {
    field.classList.remove('input-valid', 'input-invalid');
  });
  
  // Reset stats
  updateStats(0, 0, 0);
  
  showNotification('Formulaire réinitialisé', 'success');
}

// ============================================
// STATISTICS UPDATE
// ============================================

/**
 * Update sidebar statistics
 */
function updateStats(total, monthly, reduction) {
  const totalEl = document.getElementById('statTotal');
  const monthlyEl = document.getElementById('statMonthly');
  const reductionEl = document.getElementById('statReduction');
  
  if (totalEl) totalEl.textContent = `${total.toLocaleString()} TND`;
  if (monthlyEl) monthlyEl.textContent = `${monthly.toLocaleString()} TND`;
  if (reductionEl) reductionEl.textContent = `${reduction}%`;
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Show notification toast
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-lg animate-slide-in ${
    type === 'error' ? 'bg-red-600 text-white' :
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'warning' ? 'bg-amber-500 text-white' :
    'bg-nexus-navy text-white'
  }`;
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="fas ${
        type === 'error' ? 'fa-exclamation-circle' :
        type === 'success' ? 'fa-check-circle' :
        type === 'warning' ? 'fa-exclamation-triangle' :
        'fa-info-circle'
      }"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('opacity-0');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Form inputs - auto-save on change
  document.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('change', autoSave);
    field.addEventListener('input', () => {
      // Remove invalid state when user starts typing
      if (field.classList.contains('input-invalid')) {
        field.classList.remove('input-invalid');
      }
    });
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Enter key in form fields
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextStep();
    }
    
    // Arrow keys for step navigation (when not in input)
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    }
  });
  
  // Before unload - warn about unsaved changes
  window.addEventListener('beforeunload', (e) => {
    // Check if form has been modified
    const form = document.getElementById('wizardForm');
    if (form && form.querySelector('input[value]')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format number as TND currency
 */
function formatTND(amount) {
  return `${amount.toLocaleString('fr-FR')} TND`;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================
// REDUCTIONS MANAGEMENT
// ============================================

/**
 * Update and calculate reductions
 */
function updateReductions() {
  const checkboxes = document.querySelectorAll('[data-rate]');
  let totalReduction = 0;
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      totalReduction += parseInt(cb.dataset.rate);
    }
  });
  
  const warning = document.getElementById('reducCapWarning');
  const derogation = document.getElementById('cumulDir');
  const capNotice = document.getElementById('reductionCapNotice');
  
  // Check if we need to apply the cap
  if (totalReduction > 10 && !derogation.checked) {
    if (warning) warning.classList.remove('hidden');
    if (capNotice) capNotice.classList.remove('hidden');
    // Apply the cap for display
    document.getElementById('totalReduction').textContent = '10%*';
  } else {
    if (warning) warning.classList.add('hidden');
    if (capNotice) capNotice.classList.add('hidden');
    document.getElementById('totalReduction').textContent = totalReduction + '%';
  }
  
  // Update sidebar stat
  const appliedReduction = (totalReduction > 10 && !derogation.checked) ? 10 : totalReduction;
  document.getElementById('statReduction').textContent = appliedReduction + '%';
}

// ============================================
// OFFERS DATA — runtime sync with data/offres-nexus.json
// ============================================

const RECOMMENDATION_KEYS = {
  terminaleLibreMixte: 'terminaleLibreMixte',
  terminaleLibrePremium: 'terminaleLibrePremium',
  terminaleLibreOnline: 'terminaleLibreOnline',
  duoTerminaleNexus: 'duoTerminaleNexus',
  excellenceTerminale: 'excellenceTerminale',
  terminaleSpecialiteSimple: 'terminaleSpecialiteSimple',
  premiereLibreEssentiel: 'premiereLibreEssentiel',
  premiereLibreAccompagnee: 'premiereLibreAccompagnee',
  premiereDoubleSecurite: 'premiereDoubleSecurite',
  premiereEafFrancais: 'premiereEafFrancais',
  premiereMathsAnticipees: 'premiereMathsAnticipees',
  premiereSciences: 'premiereSciences',
  secondeMathsMethode: 'secondeMathsMethode',
  secondeSciences: 'secondeSciences',
  brevetMaths: 'brevetMaths',
  brevetComplet: 'brevetComplet',
  plateformeAutonomie: 'plateformeAutonomie',
  plateformeSuivi: 'plateformeSuivi',
  plateformeAccompagnee: 'plateformeAccompagnee'
};

const OFFER_META = {
  terminaleLibreMixte: {
    desc: 'Présentiel + plateforme — parcours complet candidat libre.',
    inc: [
      'Spécialités, Grand Oral, tronc commun selon carte d\'examen',
      'Présentiel hebdomadaire en groupe de 5 max',
      'Bacs blancs en conditions réelles + correction détaillée',
      'Carte d\'examen personnalisée : accompagnement administratif complet',
      'Bulletin trimestriel Nexus + conseil de classe individuel',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Accompagnement Parcoursup et orientation'
    ]
  },
  terminaleLibrePremium: {
    desc: 'Mixte + coaching + urgence — accompagnement maximal candidat libre.',
    inc: [
      'Tout le parcours Mixte en groupe de 5 max',
      'Coaching individuel et suivi parent renforcé',
      '6 h d\'accompagnement en ligne d\'urgence incluses',
      'Priorité de planification sur les stages',
      'Préparation Parcoursup : dossier et entretiens optimisés',
      'Bulletin trimestriel Nexus + conseil de classe individuel',
      'Carte d\'examen et accompagnement administratif complet',
      'Points parents mensuels : transparence totale'
    ]
  },
  terminaleLibreOnline: {
    desc: 'Parcours candidat libre à distance avec plateforme et lives.',
    inc: [
      'Plateforme pédagogique complète avec vidéos et exercices',
      'Lives interactifs réguliers avec enseignants',
      'Cadrage examen, progression et corrections',
      'Bulletin trimestriel Nexus + suivi à distance',
      'Compte parent et bilans réguliers'
    ]
  },
  duoTerminaleNexus: {
    desc: 'Deux enseignements, stages et Grand Oral pour Terminale scolarisée.',
    inc: [
      '2 spécialités de coefficient 16 en groupe de 5 max',
      'Stages vacances inclus (Toussaint, février, printemps)',
      'Préparation complète au Grand Oral',
      'Bacs blancs en conditions réelles + correction détaillée',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Coaching scolaire, méthodologie et accompagnement Parcoursup'
    ]
  },
  excellenceTerminale: {
    desc: 'Deux spécialités + Mathématiques expertes pour dossiers sélectifs.',
    inc: [
      '2 spécialités + Mathématiques expertes en groupe de 5 max',
      'Stages vacances inclus (Toussaint, février, printemps)',
      'Préparation au Grand Oral scientifique',
      '2 h d\'accompagnement en ligne d\'urgence incluses',
      'Bacs blancs en conditions réelles + correction détaillée',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Préparation Parcoursup : dossier et entretiens optimisés'
    ]
  },
  premiereLibreEssentiel: {
    desc: 'Socle candidat libre en autonomie encadrée.',
    inc: [
      'Plateforme pédagogique complète avec vidéos et exercices',
      'Cadrage EAF, EAM et calendrier candidat libre',
      'Suivi léger mais régulier pour garder le rythme',
      'Bulletin trimestriel Nexus',
      'Compte parent et bilans'
    ]
  },
  premiereLibreAccompagnee: {
    desc: 'Présentiel + plateforme pour Première candidat libre.',
    inc: [
      'EAF + EAM avec accompagnement régulier en groupe de 5 max',
      'Présentiel hebdomadaire et plateforme complète',
      'Oraux blancs et sujets types inclus',
      'Accompagnement administratif (carte d\'examen, calendrier)',
      'Bulletin trimestriel Nexus + conseil de classe individuel',
      'Compte parent et bilans de progression réguliers'
    ]
  },
  premiereDoubleSecurite: {
    desc: 'EAF + EAM sécurisées pour Première scolarisée.',
    inc: [
      'EAF Français (écrit + oral) en groupe de 5 max',
      'EAM Mathématiques anticipées en groupe de 5 max',
      'Oraux blancs et sujets types inclus',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Coaching scolaire et méthodologie de travail',
      'Continuité garantie vers le parcours Terminale'
    ]
  },
  secondeMathsMethode: {
    desc: 'Mathématiques, méthode et régularité pour consolider la Seconde.',
    inc: [
      'Mathématiques hebdomadaires en groupe de 5 max',
      'Méthode de travail et organisation',
      'Préparation progressive des choix de spécialités',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus + espace parent dédié',
      'Bilans de progression réguliers'
    ]
  },
  secondeSciences: {
    desc: 'Maths + sciences pour préparer les choix de spécialités.',
    inc: [
      'Mathématiques et raisonnement scientifique, 4 h / semaine',
      'Groupe de 5 max, niveaux homogènes',
      'Préparation aux attendus de Première',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus + espace parent dédié',
      'Aide à l\'arbitrage des spécialités',
      'Bilans de progression réguliers'
    ]
  },
  brevetMaths: {
    desc: 'Renforcement mathématiques pour le DNB.',
    inc: [
      'Cours de mathématiques en petit groupe de 5 max',
      'Méthode de résolution et rédaction',
      'Annales, sujets blancs et progression suivie',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus + espace parent dédié',
      'Bilans de progression réguliers'
    ]
  },
  brevetComplet: {
    desc: 'Préparation DNB plus globale avec cadrage régulier.',
    inc: [
      'Maths + Français en groupe de 5 max',
      'Planning de révision structuré',
      'Brevet blanc corrigé en conditions réelles',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus + espace parent dédié',
      'Bilans de progression réguliers',
      'Préparation de la transition vers la Seconde'
    ]
  },
  terminaleSpecialiteSimple: {
    desc: 'Une spécialité renforcée en groupe réduit pour Terminale scolarisée.',
    inc: [
      '1 spécialité au choix, 2 h / semaine en groupe de 5 max',
      'Bacs blancs en conditions réelles + correction détaillée',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Coaching scolaire et méthodologie de travail'
    ]
  },
  premiereEafFrancais: {
    desc: 'Épreuve anticipée de français : écrit + oral, méthode et entraînement.',
    inc: [
      'Méthodes de l\'écrit (commentaire, dissertation, contraction)',
      'Préparation de l\'oral : oraux blancs inclus',
      'Sujets types EAF et corrections détaillées',
      'Groupe de 5 max, niveaux homogènes',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents'
    ]
  },
  premiereMathsAnticipees: {
    desc: 'Épreuve anticipée de mathématiques : automatismes, méthode et sujets types.',
    inc: [
      'Automatismes et techniques de calcul',
      'Méthode de rédaction mathématique',
      'Sujets types EAM et corrections détaillées',
      'Groupe de 5 max, niveaux homogènes',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents'
    ]
  },
  premiereSciences: {
    desc: 'Maths + sciences pour première scolarisée, préparation EAM renforcée.',
    inc: [
      'Mathématiques et raisonnement scientifique',
      'Préparation EAM et automatismes',
      'Groupe de 5 max, niveaux homogènes',
      'Bilan de positionnement initial offert',
      'Plateforme Nexus illimitée + espace parent dédié',
      'Bilans de progression réguliers communiqués aux parents',
      'Continuité vers la Terminale'
    ]
  },
  plateformeAutonomie: {
    desc: 'Plateforme en autonomie pour les élèves organisés, hors Tunis.',
    inc: [
      'Ressources, fiches, exercices et sujets corrigés',
      'Parcours personnalisé en autonomie',
      'Accès illimité 24/7 à la plateforme Nexus'
    ]
  },
  plateformeSuivi: {
    desc: 'Plateforme avec suivi léger et visibilité parents.',
    inc: [
      'Tout l\'abonnement Autonomie',
      'Compte parent + bilans réguliers',
      '1 atelier collectif en ligne / mois'
    ]
  },
  plateformeAccompagnee: {
    desc: 'Véritable accompagnement à distance avec séances live.',
    inc: [
      'Tout l\'abonnement Suivi',
      '1 séance live en groupe / semaine',
      'Corrections personnalisées ponctuelles'
    ]
  }
};

function formatAnnualDisplay(offer) {
  if (offer.annualDisplay) return offer.annualDisplay;
  if (offer.annual != null) return `${offer.annual.toLocaleString('fr-FR')} TND / an`;
  if (offer.display) return offer.display;
  return 'Tarif à valider';
}

function formatMainDisplay(offer) {
  if (offer.display) return offer.display;
  if (offer.monthly != null) {
    return `${offer.approx ? '≈ ' : 'dès '}${offer.monthly.toLocaleString('fr-FR')} TND / mois`;
  }
  return formatAnnualDisplay(offer);
}

function buildInstallments(offer) {
  if (Array.isArray(offer.echeancier) && offer.echeancier.length > 0) {
    const labels = offer.echeancier.length === 4
      ? ['Réservation', 'Trimestre 1', 'Trimestre 2', 'Trimestre 3']
      : offer.echeancier.length === 5
        ? ['Réservation', 'Versement 1', 'Versement 2', 'Versement 3', 'Versement 4']
        : offer.echeancier.length === 9
          ? ['Réservation', 'Mensualité 1', 'Mensualité 2', 'Mensualité 3', 'Mensualité 4', 'Mensualité 5', 'Mensualité 6', 'Mensualité 7', 'Mensualité 8']
          : offer.echeancier.map((_, index) => (index === 0 ? 'Réservation' : `Versement ${index}`));

    return offer.echeancier.map((amount, index) => ({
      label: labels[index] || `Versement ${index + 1}`,
      amount
    }));
  }

  if (offer.monthly != null && offer.annual != null) {
    return [{ label: 'Repère mensuel', amount: offer.monthly }];
  }

  if (offer.annual != null) {
    return [{ label: 'Tarif annuel', amount: offer.annual }];
  }

  return [];
}

function normalizeOffer(key, jsonOffer) {
  const meta = OFFER_META[key] || {};
  return {
    ...jsonOffer,
    ...meta,
    key,
    label: jsonOffer.label,
    annual: jsonOffer.annual || 0,
    displayPrice: formatMainDisplay(jsonOffer),
    annualDisplay: formatAnnualDisplay(jsonOffer),
    ech: buildInstallments(jsonOffer),
    inc: meta.inc || [],
    desc: meta.desc || jsonOffer.sub || 'Offre Nexus à valider selon le profil.'
  };
}

async function loadCanonicalOffers() {
  if (offersLoadPromise) return offersLoadPromise;

  offersLoadPromise = fetch(CONFIG.offersUrl, {
    credentials: 'same-origin',
    cache: 'no-store'
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Chargement offres impossible (${response.status})`);
      }
      return response.json();
    })
    .then(data => {
      const nextOffers = {};
      Object.entries(data).forEach(([key, value]) => {
        if (!key.startsWith('_')) {
          nextOffers[key] = normalizeOffer(key, value);
        }
      });
      OFFERS = nextOffers;
      return OFFERS;
    });

  return offersLoadPromise;
}

function getOffer(key) {
  return OFFERS[key] || null;
}

// ============================================
// RECOMMENDATION ENGINE
// ============================================

/**
 * Generate recommendation based on profile
 */
function generateRecommendation() {
  const level = document.getElementById('level')?.value;
  const status = document.getElementById('status')?.value;
  const objectif = document.querySelector('input[name="objectif"]:checked')?.value;
  const budget = document.querySelector('input[name="budget"]:checked')?.value;
  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  
  if (!level || !status) {
    showNotification('Veuillez compléter le profil scolaire d\'abord', 'error');
    return;
  }
  
  let recommended = null;
  let alternatives = [];
  
  // Decision tree
  if (level === 'terminale') {
    if (status === 'libre' || status === 'double') {
      if (objectif === 'selectif' || budget === 'confort') {
        recommended = getOffer(RECOMMENDATION_KEYS.terminaleLibrePremium);
        alternatives = [getOffer(RECOMMENDATION_KEYS.terminaleLibreMixte), getOffer(RECOMMENDATION_KEYS.terminaleLibreOnline)];
      } else if (mode === 'online' || budget === 'serre') {
        recommended = getOffer(RECOMMENDATION_KEYS.terminaleLibreOnline);
        alternatives = [getOffer(RECOMMENDATION_KEYS.terminaleLibreMixte)];
      } else {
        recommended = getOffer(RECOMMENDATION_KEYS.terminaleLibreMixte);
        alternatives = [getOffer(RECOMMENDATION_KEYS.terminaleLibrePremium), getOffer(RECOMMENDATION_KEYS.terminaleLibreOnline)];
      }
    } else {
      // Scolarisé
      if (objectif === 'selectif') {
        recommended = getOffer(RECOMMENDATION_KEYS.excellenceTerminale);
        alternatives = [getOffer(RECOMMENDATION_KEYS.duoTerminaleNexus), getOffer(RECOMMENDATION_KEYS.terminaleSpecialiteSimple)];
      } else if (budget === 'serre') {
        recommended = getOffer(RECOMMENDATION_KEYS.terminaleSpecialiteSimple);
        alternatives = [getOffer(RECOMMENDATION_KEYS.duoTerminaleNexus)];
      } else {
        recommended = getOffer(RECOMMENDATION_KEYS.duoTerminaleNexus);
        alternatives = [getOffer(RECOMMENDATION_KEYS.excellenceTerminale), getOffer(RECOMMENDATION_KEYS.terminaleSpecialiteSimple)];
      }
    }
  } else if (level === 'premiere') {
    if (status === 'libre' || status === 'double') {
      if (budget === 'serre' || mode === 'online') {
        recommended = getOffer(RECOMMENDATION_KEYS.premiereLibreEssentiel);
        alternatives = [getOffer(RECOMMENDATION_KEYS.premiereLibreAccompagnee)];
      } else {
        recommended = getOffer(RECOMMENDATION_KEYS.premiereLibreAccompagnee);
        alternatives = [getOffer(RECOMMENDATION_KEYS.premiereLibreEssentiel)];
      }
    } else {
      // Scolarisé
      if (budget === 'serre') {
        recommended = getOffer(RECOMMENDATION_KEYS.premiereEafFrancais);
        alternatives = [getOffer(RECOMMENDATION_KEYS.premiereMathsAnticipees), getOffer(RECOMMENDATION_KEYS.premiereDoubleSecurite)];
      } else {
        recommended = getOffer(RECOMMENDATION_KEYS.premiereDoubleSecurite);
        alternatives = [getOffer(RECOMMENDATION_KEYS.premiereEafFrancais), getOffer(RECOMMENDATION_KEYS.premiereMathsAnticipees)];
      }
    }
  } else if (level === 'seconde') {
    if (objectif === 'selectif' || budget === 'confort') {
      recommended = getOffer(RECOMMENDATION_KEYS.secondeSciences);
      alternatives = [getOffer(RECOMMENDATION_KEYS.secondeMathsMethode)];
    } else {
      recommended = getOffer(RECOMMENDATION_KEYS.secondeMathsMethode);
      alternatives = [getOffer(RECOMMENDATION_KEYS.secondeSciences)];
    }
  } else if (level === 'troisieme') {
    if (objectif === 'mention' || objectif === 'selectif') {
      recommended = getOffer(RECOMMENDATION_KEYS.brevetComplet);
      alternatives = [getOffer(RECOMMENDATION_KEYS.brevetMaths)];
    } else {
      recommended = getOffer(RECOMMENDATION_KEYS.brevetMaths);
      alternatives = [getOffer(RECOMMENDATION_KEYS.brevetComplet)];
    }
  }
  
  if (recommended) {
    displayRecommendation(recommended, alternatives.filter(Boolean));
    updateStats(recommended.annual, Math.round(recommended.annual / 10), parseInt(document.getElementById('statReduction')?.textContent || '0'));
    showNotification('Recommandation générée avec succès', 'success');
  } else {
    showNotification('Aucune formule synchronisée trouvée pour ce profil', 'error');
  }
}

/**
 * Display recommendation in UI
 */
function displayRecommendation(offer, alternatives) {
  currentRecommendation = { offer, alternatives };

  // Show the generated recommendation panel.
  document.getElementById('noRecommendation')?.classList.add('hidden');
  document.getElementById('recommendedOfferSection')?.classList.remove('hidden');
  
  // Fill main offer
  document.getElementById('offerLabel').textContent = offer.label;
  document.getElementById('offerDesc').textContent = offer.desc;
  document.getElementById('offerPrice').textContent = offer.annualDisplay;
  
  // Fill inclusions
  const includesList = document.getElementById('offerIncludes');
  if (includesList) {
    includesList.innerHTML = offer.inc.map(item => 
      `<li class="flex items-center gap-2"><i class="fas fa-check-circle text-nexus-gold"></i><span>${item}</span></li>`
    ).join('');
  }
  
  // Fill echeancier
  const echeancierDiv = document.getElementById('offerEcheancier');
  if (echeancierDiv) {
    echeancierDiv.innerHTML = offer.ech.map(item => `
      <div class="echeancier-item">
        <div class="label">${item.label}</div>
        <div class="amount">${item.amount.toLocaleString('fr-FR')} TND</div>
      </div>
    `).join('');
  }
  
  // Fill alternatives
  const alternativesList = document.getElementById('alternativesList');
  if (alternativesList && alternatives.length > 0) {
    alternativesList.innerHTML = alternatives.map(alt => `
      <div class="alternative-card">
        <h5>${alt.label}</h5>
        <div class="price">${alt.annualDisplay}</div>
        <p class="text-sm text-slate-600 dark:text-slate-400">${alt.desc}</p>
      </div>
    `).join('');
    document.getElementById('alternativesSection')?.classList.remove('hidden');
  } else {
    document.getElementById('alternativesSection')?.classList.add('hidden');
  }
  
  // Fill arguments
  const argumentsList = document.getElementById('argumentsList');
  if (argumentsList) {
    const args = getArgumentsCles(offer);
    argumentsList.innerHTML = args.map(arg => `<li>${arg}</li>`).join('');
  }

  updatePdfPreview(collectQuoteData());
}

/**
 * Get key arguments for each offer
 */
function getArgumentsCles(offer) {
  const argumentsMap = {
    terminaleLibreMixte: [
      'Pas de contrôle continu → tout se joue sur les épreuves ponctuelles',
      'Groupe de 5 max : suivi individualisé garanti',
      'Carte d\'examen personnalisée : zéro risque administratif'
    ],
    terminaleLibrePremium: [
      'Coaching individuel + suivi renforcé pour objectifs ambitieux',
      'Urgence en ligne incluse selon la formule canonique',
      'Pont Parcoursup inclus : de la prépa au Bac à l\'orientation',
      'Points parents mensuels : transparence totale sur la progression'
    ],
    terminaleLibreOnline: [
      'Flexibilité maximale pour les élèves hors Tunis ou à l\'étranger',
      'Prix accessible sans compromis sur la qualité',
      'Lives interactifs avec enseignants expérimentés',
      'Plateforme complète avec vidéos, fiches, exercices corrigés'
    ],
    duoTerminaleNexus: [
      'Stages vacances INCLUS : consolidation pendant les breaks',
      '2 spécialités coef 16 chacune : le cœur du bac sécurisé',
      'Bacs blancs en conditions réelles : pas de stress le jour J',
      'Groupe de 5 max : chacun a le temps de poser ses questions'
    ],
    excellenceTerminale: [
      'Maths expertes incluses : un atout pour les filières sélectives',
      'Préparation Parcoursup : dossier + entretiens optimisés',
      'Le parcours le plus complet pour viser la mention Très Bien',
      'Coaching scientifique pour les concours CPGE/médecine'
    ],
    premiereLibreEssentiel: [
      'Solution économique pour les familles autonomes',
      'Plateforme complète avec vidéos de cours et exercices',
      'Suivi léger mais régulier pour rester sur la bonne voie',
      'Idéal pour les élèves déjà bien organisés'
    ],
    premiereLibreAccompagnee: [
      'Le bon équilibre entre présentiel et autonomie',
      'EAF + EAM préparés avec la même rigueur que le Bac',
      'Choix de spécialités éclairés grâce aux bilans réguliers',
      'Anticipation Terminale : on pose les bases solides'
    ],
    premiereDoubleSecurite: [
      'EAF + EAM : les deux épreuves anticipées sécurisées',
      'Complémentarité parfaite avec le lycée',
      'Choix de spécialités optimisé dès la Seconde',
      'Continuité garantie vers la Terminale'
    ],
    secondeMathsMethode: [
      'Remettre la méthode au centre avant les choix de spécialités',
      'Sécuriser les automatismes de calcul et de rédaction',
      'Préparer une Première plus sereine',
      'Format progressif pour les élèves à consolider'
    ],
    secondeSciences: [
      'Préparer les spécialités scientifiques dès la Seconde',
      'Travailler maths et raisonnement scientifique ensemble',
      'Aider la famille à arbitrer les choix de Première',
      'Cadre renforcé pour objectifs sélectifs'
    ],
    brevetMaths: [
      'Priorité aux points gagnables du DNB',
      'Méthode claire sur les exercices types',
      'Rythme adapté aux élèves qui doivent consolider',
      'Suivi simple pour garder le cap'
    ],
    brevetComplet: [
      'Préparation DNB plus globale quand plusieurs matières fragilisent le dossier',
      'Planning de révision et entraînements réguliers',
      'Brevet blanc pour réduire le stress de l’examen',
      'Transition plus solide vers la Seconde'
    ],
    terminaleSpecialiteSimple: [
      'Renforcement ciblé sur UNE spécialité : efficacité maximale',
      'Tarif accessible pour les familles avec un besoin précis',
      'Groupe de 5 max : suivi individualisé garanti',
      'Possibilité d\'évoluer vers le Duo en cours d\'année'
    ],
    premiereEafFrancais: [
      'Sécuriser le français anticipé : coef 10 au bac',
      'Oraux blancs inclus pour arriver prêt(e) le jour J',
      'Méthode écrit + oral avec enseignants spécialisés',
      'Tarif accessible pour cibler l\'EAF uniquement'
    ],
    premiereMathsAnticipees: [
      'Sécuriser les maths anticipées (EAM) dès la Première',
      'Automatismes et méthode : les deux piliers de la réussite',
      'Sujets types et corrections détaillées',
      'Tarif accessible pour cibler l\'EAM uniquement'
    ],
    premiereSciences: [
      'Maths + sciences : la combinaison gagnante pour les filières scientifiques',
      'Préparation EAM renforcée',
      'Anticiper les spécialités de Terminale',
      'Cadre renforcé pour objectifs ambitieux'
    ],
    plateformeAutonomie: [
      'La solution la plus accessible pour travailler partout',
      'Idéal pour les élèves autonomes et organisés',
      'Accès 24/7 : travaillez à votre rythme',
      'Économie maximale par rapport au présentiel'
    ],
    plateformeSuivi: [
      'Cadre structurant avec visibilité parents',
      'Bilans réguliers pour rester sur la bonne voie',
      '1 atelier collectif mensuel pour garder le lien',
      'Bon compromis entre autonomie et suivi'
    ],
    plateformeAccompagnee: [
      'Véritable suivi à distance avec séances live hebdomadaires',
      'Corrections personnalisées pour progresser concrètement',
      'Pour les familles hors Tunis voulant un vrai accompagnement',
      'Qualité proche du présentiel, sans les contraintes de déplacement'
    ]
  };
  
  return argumentsMap[offer.key] || ['Offre adaptée au profil de l\'élève'];
}

// ============================================
// PDF GENERATION
// ============================================

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatValue(value, fallback = 'À préciser') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getFieldValue(id, fallback = 'À préciser') {
  return formatValue(document.getElementById(id)?.value, fallback);
}

function getSelectText(id, fallback = 'À préciser') {
  const select = document.getElementById(id);
  const selected = select?.selectedOptions?.[0]?.textContent;
  return formatValue(selected, fallback);
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(input => {
      const label = input.closest('label')?.textContent || input.value;
      return label.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}

function getCheckedRadioText(name, fallback = 'À préciser') {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  if (!input) return fallback;
  return formatValue(input.closest('label')?.textContent?.replace(/\s+/g, ' '), input.value);
}

function getActiveReductionLabels() {
  return Array.from(document.querySelectorAll('#step-4 input[type="checkbox"]:checked'))
    .filter(input => input.id !== 'cumulDir')
    .map(input => {
      const row = input.closest('label');
      const title = row?.querySelector('.font-semibold')?.textContent || row?.textContent || input.name;
      return title.replace(/\s+/g, ' ').trim();
    });
}

function getQuoteNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return `NX-${yyyy}${mm}${dd}-${String(array[0] % 10000).padStart(4, '0')}`;
}

function collectQuoteData() {
  const offer = currentRecommendation?.offer || getOfferFromUi();
  const publicAnnual = offer?.publicAnnual || null;
  const monthly = offer?.monthly || null;
  const economie = (publicAnnual && offer?.annual) ? publicAnnual - offer.annual : 0;
  const monthlyDisplay = monthly ? `≈ ${monthly.toLocaleString('fr-FR')} TND / mois` : null;
  const alternatives = currentRecommendation?.alternatives || [];
  const reduction = document.getElementById('totalReduction')?.textContent?.trim() || '0%';
  const reductionLabels = getActiveReductionLabels();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);

  return {
    quoteNumber: getQuoteNumber(),
    generatedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    validUntil: validUntil.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    studentName: getFieldValue('studentName', 'Élève à préciser'),
    parentName: getFieldValue('parentName', 'Responsable à préciser'),
    whatsapp: getFieldValue('whatsapp', 'À préciser'),
    email: getFieldValue('email', 'À préciser'),
    advisor: getFieldValue('advisor', 'Nexus Réussite'),
    level: getSelectText('level'),
    status: getSelectText('status'),
    establishment: getFieldValue('etablissement', 'Non renseigné'),
    languages: getFieldValue('lva', 'Non renseigné'),
    currentLevel: getSelectText('niveauMat'),
    specialites: getCheckedValues('specialites'),
    options: getCheckedValues('options'),
    modalite: getSelectText('modalite', 'Non applicable'),
    objectif: getCheckedRadioText('objectif'),
    budget: getCheckedRadioText('budget'),
    mode: getCheckedRadioText('mode'),
    internalNotes: getFieldValue('notesInternes', ''),
    reduction,
    reductionLabels,
    publicAnnual,
    monthlyDisplay,
    economie,
    hasDirectionOverride: Boolean(document.getElementById('cumulDir')?.checked),
    offer: offer || {
      label: document.getElementById('offerLabel')?.textContent || 'Offre à valider',
      desc: document.getElementById('offerDesc')?.textContent || '',
      annualDisplay: document.getElementById('offerPrice')?.textContent || 'Tarif à valider',
      inc: [],
      ech: []
    },
    alternatives
  };
}

function getOfferFromUi() {
  const label = document.getElementById('offerLabel')?.textContent?.trim();
  if (!label || label === '—') return null;
  const offer = Object.values(OFFERS).find(item => item.label === label);
  return offer || null;
}

function buildList(items) {
  if (!items || items.length === 0) return '<li>À préciser lors de la validation pédagogique.</li>';
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function buildInstallmentRows(installments) {
  if (!installments || installments.length === 0) {
    return '<tr><td colspan="2">Échéancier communiqué après validation du format définitif.</td></tr>';
  }

  return installments.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td class="pdf-money">${escapeHtml(item.amount.toLocaleString('fr-FR'))} TND</td>
    </tr>
  `).join('');
}

function buildAlternativeCards(alternatives) {
  if (!alternatives || alternatives.length === 0) {
    return '<p class="pdf-muted">Aucune alternative prioritaire n’a été retenue pour ce profil.</p>';
  }

  return alternatives.map(alt => `
    <div class="pdf-mini-card">
      <strong>${escapeHtml(alt.label)}</strong>
      <span>${escapeHtml(alt.annualDisplay)}</span>
      <p>${escapeHtml(alt.desc)}</p>
    </div>
  `).join('');
}

function buildPremiumQuoteHtml(data) {
  const offer = data.offer;
  const reductionCopy = data.reductionLabels.length
    ? `${data.reduction} — ${data.reductionLabels.join(', ')}${data.hasDirectionOverride ? ' avec validation direction' : ''}`
    : 'Aucune réduction appliquée à ce stade';
  const formatLabel = [data.level, data.status].filter(Boolean).join(' · ');
  const specialtyLabel = data.specialites.length ? data.specialites.join(', ') : 'À préciser';

  return `
    <article class="pdf-document">
      <div class="pdf-brand-bar"></div>

      <header class="pdf-invoice-header">
        <section class="pdf-issuer-block" aria-label="ÉMETTEUR">
          <p class="pdf-kicker">ÉMETTEUR</p>
          <h1>M&M ACADEMY (NEXUS RÉUSSITE)</h1>
          <p>Établissement d’accompagnement pédagogique</p>
          <p>Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 Tunis</p>
          <p>MF : 1948837 N/A/M/000</p>
          <p>+216 99 19 28 29 · contact@nexusreussite.academy</p>
        </section>

        <section class="pdf-title-block">
          <p class="pdf-document-type">PROPOSITION</p>
          <h2>Devis personnalisé</h2>
          <p class="pdf-document-subtitle">Nexus Réussite — Proposition d’accompagnement 2026/2027</p>
          <dl>
            <div><dt>Référence</dt><dd>${escapeHtml(data.quoteNumber)}</dd></div>
            <div><dt>Date</dt><dd>${escapeHtml(data.generatedAt)}</dd></div>
            <div><dt>Validité</dt><dd>${escapeHtml(data.validUntil)}</dd></div>
          </dl>
        </section>
      </header>

      <section class="pdf-party-row">
        <div class="pdf-party-box">
          <p class="pdf-kicker">PROPOSITION POUR</p>
          <strong>${escapeHtml(data.parentName)}</strong>
          <span>${escapeHtml(data.email)}</span>
          <span>${escapeHtml(data.whatsapp)}</span>
        </div>
        <div class="pdf-party-box">
          <p class="pdf-kicker">ÉLÈVE ET PROFIL</p>
          <strong>${escapeHtml(data.studentName)}</strong>
          <span>${escapeHtml(formatLabel)}</span>
          <span>${escapeHtml(data.establishment)}</span>
        </div>
      </section>

      <section class="pdf-status-strip">
        <div>
          <p class="pdf-section-eyebrow">Synthèse de la recommandation</p>
          <h2>${escapeHtml(offer.label)}</h2>
          <p>${escapeHtml(offer.desc)}</p>
        </div>
        <div class="pdf-total-box">
          <span>TOTAL INDICATIF</span>
          <strong>${escapeHtml(offer.annualDisplay)}</strong>
          <small>${escapeHtml(reductionCopy)}</small>
        </div>
      </section>

      <section class="pdf-section">
        <h3>TABLEAU DE SYNTHÈSE</h3>
        <table class="pdf-summary-table">
          <thead>
            <tr>
              <th>DÉSIGNATION</th>
              <th>FORMAT</th>
              <th>REPÈRE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${escapeHtml(offer.label)}</strong>
                <span>${escapeHtml(offer.desc)}</span>
              </td>
              <td>${escapeHtml(data.mode)}<br><span>${escapeHtml(data.objectif)}</span></td>
              <td class="pdf-money">${escapeHtml(offer.annualDisplay)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="pdf-grid pdf-section">
        <div>
          <h3>Profil élève et famille</h3>
          <dl class="pdf-definition-list">
            <div><dt>Élève</dt><dd>${escapeHtml(data.studentName)}</dd></div>
            <div><dt>Responsable</dt><dd>${escapeHtml(data.parentName)}</dd></div>
            <div><dt>WhatsApp</dt><dd>${escapeHtml(data.whatsapp)}</dd></div>
            <div><dt>E-mail</dt><dd>${escapeHtml(data.email)}</dd></div>
            <div><dt>Niveau</dt><dd>${escapeHtml(data.level)}</dd></div>
            <div><dt>Statut</dt><dd>${escapeHtml(data.status)}</dd></div>
            <div><dt>Établissement</dt><dd>${escapeHtml(data.establishment)}</dd></div>
            <div><dt>Langues</dt><dd>${escapeHtml(data.languages)}</dd></div>
          </dl>
        </div>
        <div>
          <h3>Besoin pédagogique</h3>
          <dl class="pdf-definition-list">
            <div><dt>Objectif</dt><dd>${escapeHtml(data.objectif)}</dd></div>
            <div><dt>Sensibilité budget</dt><dd>${escapeHtml(data.budget)}</dd></div>
            <div><dt>Mode privilégié</dt><dd>${escapeHtml(data.mode)}</dd></div>
            <div><dt>Niveau ressenti</dt><dd>${escapeHtml(data.currentLevel)}</dd></div>
            <div><dt>Spécialités</dt><dd>${escapeHtml(specialtyLabel)}</dd></div>
            <div><dt>Options</dt><dd>${escapeHtml(data.options.join(', ') || 'Non renseigné')}</dd></div>
            <div><dt>Modalité candidat libre</dt><dd>${escapeHtml(data.modalite)}</dd></div>
          </dl>
        </div>
      </section>

      <section class="pdf-section pdf-two-columns">
        <div>
          <h3>Échéancier indicatif</h3>
          <table class="pdf-table premium">
            <tbody>${buildInstallmentRows(offer.ech)}</tbody>
          </table>
        </div>
        <div>
          <h3>Ce qui est inclus dans le parcours</h3>
          <ul class="pdf-check-list compact">${buildList(offer.inc)}</ul>
        </div>
      </section>

      <section class="pdf-section pdf-two-columns">
        <div>
          <h3>Alternatives étudiées</h3>
          <div class="pdf-mini-card-list">${buildAlternativeCards(data.alternatives)}</div>
        </div>
        <div class="pdf-conditions-box">
          <h3>CONDITIONS DE VALIDATION</h3>
          <p>Validation pédagogique, disponibilité du groupe, pièces administratives et règlement de la réservation.</p>
          <p>Le tarif et l’échéancier restent indicatifs jusqu’à inscription définitive.</p>
        </div>
      </section>

      <section class="pdf-section">
        <h3>Prochaines étapes</h3>
        <ol class="pdf-timeline">
          <li><strong>Validation pédagogique</strong><span>Confirmer le niveau, le statut, les spécialités et les disponibilités.</span></li>
          <li><strong>Validation administrative</strong><span>Contrôler les pièces utiles, la carte d’examen et le calendrier Cyclades si candidat libre.</span></li>
          <li><strong>Réservation</strong><span>Bloquer la place dans le groupe sous réserve de disponibilité et de paiement de la réservation.</span></li>
        </ol>
      </section>

      <section class="pdf-section pdf-legal">
        <h3>Cadre et réserves</h3>
        <p>Cette proposition non contractuelle est un repère d’accompagnement établi à partir des informations communiquées pendant l’entretien. L’inscription définitive dépend de la validation pédagogique, des places disponibles, des pièces administratives et du calendrier officiel.</p>
        <p>Nexus Réussite formalise un engagement de moyens : accompagnement structuré, suivi, entraînement et cadre de travail. Aucune progression, mention ou réussite à l’examen ne peut être garantie.</p>
      </section>

      <footer class="pdf-signature pdf-footer">
        <div>
          <strong>Nexus Réussite</strong>
          <span>nexusreussite.academy · +216 99 192 829 · contact@nexusreussite.academy</span>
        </div>
        <div>
          <strong>Conseiller</strong>
          <span>${escapeHtml(data.advisor)}</span>
        </div>
      </footer>
    </article>
  `;
}

function updatePdfPreview(data) {
  const container = document.getElementById('pdfPreviewContainer');
  if (!container || !data?.offer) return;

  container.innerHTML = `
    <div class="pdf-preview-card">
      <div class="pdf-preview-topline"></div>
      <strong>${escapeHtml(data.offer.label)}</strong>
      <span>${escapeHtml(data.studentName)}</span>
      <p>${escapeHtml(data.offer.annualDisplay)}</p>
      <small>Devis premium prêt à télécharger</small>
    </div>
  `;
}

function getFilenameFromDisposition(disposition, fallback) {
  const match = /filename="([^"]+)"/i.exec(disposition || '');
  return match ? match[1] : fallback;
}

/**
 * Generate PDF from current data
 */
async function generatePDF() {
  const element = document.getElementById('recommendedOfferSection');
  if (!element || element.classList.contains('hidden')) {
    showNotification('Veuillez d\'abord générer une recommandation', 'error');
    return;
  }

  showNotification('Génération du PDF en cours...', 'info');

  const quoteData = collectQuoteData();

  try {
    const response = await fetch('/api/assistante/quotes/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });

    if (!response.ok) {
      throw new Error(`PDF server responded ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const studentName = quoteData.studentName || 'eleve';
    const fallbackFilename = `Devis-Nexus-${studentName.replace(/[^\w-]+/g, '-')}-${quoteData.quoteNumber}.pdf`;
    const filename = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fallbackFilename);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    showNotification('PDF téléchargé avec succès', 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    showNotification('Erreur lors de la génération du PDF', 'error');
  }
}

// ============================================
// WHATSAPP COPY
// ============================================

/**
 * Copy WhatsApp message to clipboard
 */
function copyWhatsApp() {
  const studentName = document.getElementById('studentName')?.value || '';
  const offerLabel = document.getElementById('offerLabel')?.textContent || '';
  const offerPrice = document.getElementById('offerPrice')?.textContent || '';
  
  if (!offerLabel || offerLabel === '—') {
    showNotification('Veuillez d\'abord générer une recommandation', 'error');
    return;
  }
  
  const message = `Bonjour ! 👋

Voici votre recommandation personnalisée Nexus Réussite pour ${studentName || 'votre enfant'} :

📋 *OFFRE RECOMMANDÉE : ${offerLabel}*
💰 Repère tarifaire : ${offerPrice}

Pour réserver votre place ou poser des questions :
📱 +216 99 192 829
🌐 nexusreussite.academy

À très bientôt ! 🎓`;
  
  navigator.clipboard.writeText(message).then(() => {
    showNotification('Message WhatsApp copié !', 'success');
  }).catch(err => {
    console.error('Clipboard error:', err);
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = message;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification('Message WhatsApp copié !', 'success');
  });
}

// ============================================
// EXPORTS (for testing/modules)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    goToStep,
    validateStep,
    autoSave,
    loadFromLocalStorage,
    toggleDarkMode,
    updateReductions,
    generateRecommendation
  };
}
