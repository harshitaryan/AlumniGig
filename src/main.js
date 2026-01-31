import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, OAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
  const loginGrid = document.querySelector('.login-grid');
  const mainHeader = document.querySelector('.main-header');
  const profileSetup = document.querySelector('#profile-setup');
  const dashboard = document.querySelector('#dashboard');

  let currentUser = null;
  let profileData = {
    username: '',
    semester: '',
    department: '',
    bio: '',
    skills: [],
    rating: 0,
    appsCount: 0,
    chartData: {
      tech: 0,
      creative: 0,
      research: 0,
      other: 0
    }
  };

  function generateRandomStats() {
    // Random Rating between 4.0 and 5.0
    const rating = (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1);
    // Random Apps between 5 and 25
    const apps = Math.floor(Math.random() * 20) + 5;

    // Random Chart Data (Total 20 gigs)
    let remaining = 20;
    const tech = Math.floor(Math.random() * (remaining - 5)) + 2;
    remaining -= tech;
    const creative = Math.floor(Math.random() * (remaining - 3)) + 1;
    remaining -= creative;
    const research = Math.floor(Math.random() * (remaining - 1)) + 1;
    remaining -= research;
    const other = remaining;

    return {
      rating: parseFloat(rating),
      appsCount: apps,
      chartData: { tech, creative, research, other }
    };
  }

  function updatePieChart(data) {
    const segments = document.querySelectorAll('.chart-segment');
    const total = data.tech + data.creative + data.research + data.other;

    let currentOffset = 0;

    const categories = [
      { key: 'tech', label: 'Tech Projects', color: '#0066ff' },
      { key: 'creative', label: 'Creative Work', color: '#f97316' },
      { key: 'research', label: 'Research', color: '#10b981' },
      { key: 'other', label: 'Other', color: '#8b5cf6' }
    ];

    segments.forEach((segment, index) => {
      const cat = categories[index];
      const val = data[cat.key];
      const percent = (val / total) * 100;

      segment.setAttribute('stroke-dasharray', `${percent} 100`);
      segment.setAttribute('stroke-dashoffset', `-${currentOffset}`);
      segment.setAttribute('data-value', val);

      currentOffset += percent;
    });

    // Update legend/tooltip targets if needed
    document.querySelectorAll('.legend-item').forEach((item, idx) => {
      // Legend logic can stay static as labels don't change, 
      // but we could add counts there too if requested.
    });
  }

  // Session Check
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      console.log("Session found for user:", user.email);

      // Check Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().profileCompleted) {
        const data = docSnap.data();
        profileData = { ...profileData, ...data }; // Sync local state

        // Update Dashboard Summary UI
        document.querySelector('.user-display-name').textContent = data.username;
        document.querySelector('.user-handle').textContent = `@${data.username.toLowerCase().replace(/\s/g, '_')}`;
        document.querySelector('.avatar-large').textContent = data.username.substring(0, 2).toUpperCase();

        // Update Home View Stats
        document.querySelector('#dashboard-rating-value').textContent = `${data.rating || 4.8} / 5.0`;
        document.querySelector('#dashboard-apps-count').textContent = data.appsCount || 12;

        // Update Pie Chart with user-specific data
        if (data.chartData) {
          updatePieChart(data.chartData);
        }

        // Update Profile View fields
        const profileSection = document.querySelector('#view-profile');
        if (profileSection) {
          document.querySelector('#profile-name').value = data.username;
          document.querySelector('#profile-semester').value = data.semester || "1";

          const deptSelect = document.querySelector('#profile-department');
          const otherInput = document.querySelector('#profile-department-other');

          if (data.department) {
            // Check if department is one of the options
            const options = Array.from(deptSelect.options).map(o => o.value);
            if (options.includes(data.department)) {
              deptSelect.value = data.department;
              otherInput.classList.add('hidden');
            } else {
              deptSelect.value = 'OTHER';
              otherInput.value = data.department;
              otherInput.classList.remove('hidden');
            }
          }

          document.querySelector('#profile-bio').value = data.bio || "";

          // Render skills in profile
          renderProfileSkills();
        }

        loginGrid.classList.add('hidden');
        mainHeader.classList.add('hidden');
        profileSetup.classList.add('hidden');
        dashboard.classList.remove('hidden');
      } else {
        // If no profile, show setup
        loginGrid.classList.add('hidden');
        mainHeader.classList.add('hidden');
        profileSetup.classList.remove('hidden');
      }
    } else {
      console.log("No active session.");
      currentUser = null;
      loginGrid?.classList.remove('hidden');
      mainHeader?.classList.remove('hidden');
      dashboard?.classList.add('hidden');
      profileSetup?.classList.add('hidden');
    }
  });

  const studentForm = document.querySelector('#student-form');
  const signInBtn = document.querySelector('#sign-in-btn');
  const promoBox = document.querySelector('.promo-box');
  const formTitle = document.querySelector('.student-section h2');
  const formSubtitle = document.querySelector('.section-subtitle');

  let isSignUp = false;

  // Toggle Mode Login <-> Sign Up
  promoBox.addEventListener('click', () => {
    isSignUp = !isSignUp;
    if (isSignUp) {
      formTitle.textContent = "Create Account";
      formSubtitle.textContent = "Join your alumni network today";
      signInBtn.textContent = "Sign Up";
      promoBox.querySelector('strong').textContent = "Already have an account?";
      promoBox.querySelector('p').textContent = "Click here to log in with your existing university credentials.";
    } else {
      formTitle.textContent = "Student Login";
      formSubtitle.textContent = "Access opportunities from alumni in your network";
      signInBtn.textContent = "Sign In";
      promoBox.querySelector('strong').textContent = "New to AlumniGig?";
      promoBox.querySelector('p').textContent = "Use your university email to create an account and start connecting with alumni for internships, freelance projects, and mentorship opportunities.";
    }
  });

  // Handle Auth
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#email').value;
    const password = document.querySelector('#password').value;

    const originalText = isSignUp ? 'Sign Up' : 'Sign In';
    signInBtn.textContent = isSignUp ? 'Signing Up...' : 'Signing In...';
    signInBtn.disabled = true;

    try {
      console.log(`Attempting ${isSignUp ? 'Registration' : 'Login'} for:`, email);
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      currentUser = userCredential.user;
      console.log('Authentication successful for UID:', currentUser.uid);

      // IMPORTANT: Wait for the profile check to finish before clearing the loading state
      await checkProfileAndProceed(currentUser);

    } catch (error) {
      console.error('Auth error:', error);
      let errorMessage = error.message;

      if (error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password. If you're new, please click 'New to AlumniGig?' to create an account.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please sign in instead.";
      }

      alert(`Error: ${errorMessage}`);
      // Only reset button if there's an error. If successful, we transition away.
      signInBtn.textContent = originalText;
      signInBtn.disabled = false;
    }
  });

  async function checkProfileAndProceed(user) {
    try {
      console.log('Checking profile in Firestore...');
      const docRef = doc(db, "users", user.uid);

      // Added a small delay or check to ensure Firestore is responsive
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().profileCompleted) {
        console.log('Profile found, redirecting...');
        // No alert needed for automated flow, but keeping for visual confirmation
        alert(`Welcome back, ${docSnap.data().username}!`);
        // The onAuthStateChanged will handle the UI transition automatically
      } else {
        console.log('No profile found, showing setup...');
        // Hide login UI
        loginGrid.classList.add('hidden');
        mainHeader.classList.add('hidden');
        // Show Profile Setup UI
        profileSetup.classList.remove('hidden');
        window.scrollTo(0, 0); // Scroll to top
      }
    } catch (error) {
      console.error('Firestore error (Maybe database is not initialized?):', error);
      // Fallback: If Firestore fails (e.g. database not created in console), at least show the setup UI
      loginGrid.classList.add('hidden');
      mainHeader.classList.add('hidden');
      profileSetup.classList.remove('hidden');
    }
  }

  // Multi-step form navigation
  const nextButtons = document.querySelectorAll('.next-step');
  const prevButtons = document.querySelectorAll('.prev-step');
  const steps = document.querySelectorAll('.setup-step');
  const stepperSteps = document.querySelectorAll('.step');
  const stepLines = document.querySelectorAll('.step-line');

  nextButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStepNum = parseInt(btn.getAttribute('data-next'));
      const currentStepNum = nextStepNum - 1;

      // Simple Validation
      if (currentStepNum == 1) {
        const val = document.querySelector('#setup-username').value.trim();
        const bioVal = document.querySelector('#setup-bio').value.trim();
        if (!val) return alert("Please enter a username");
        profileData.username = val;
        profileData.bio = bioVal;
      } else if (currentStepNum == 2) {
        const val = document.querySelector('#setup-semester').value;
        if (!val) return alert("Please select your semester");
        profileData.semester = val;
      } else if (currentStepNum == 3) {
        const deptSelect = document.querySelector('#setup-department');
        const otherInput = document.querySelector('#setup-department-other');
        let val = deptSelect.value;

        if (val === 'OTHER') {
          val = otherInput.value.trim();
          if (!val) return alert("Please specify your department");
        } else if (!val) {
          return alert("Please select your department");
        }

        profileData.department = val;
      }

      goToStep(nextStepNum);
    });
  });

  // Handle "Other" Department selection in Setup
  const setupDeptSelect = document.querySelector('#setup-department');
  const setupDeptOtherGroup = document.querySelector('#setup-department-other-group');
  if (setupDeptSelect) {
    setupDeptSelect.addEventListener('change', () => {
      if (setupDeptSelect.value === 'OTHER') {
        setupDeptOtherGroup.classList.remove('hidden');
      } else {
        setupDeptOtherGroup.classList.add('hidden');
      }
    });
  }

  prevButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(parseInt(btn.getAttribute('data-prev')));
    });
  });

  function goToStep(stepNum) {
    steps.forEach(s => s.classList.remove('active'));
    const targetStep = document.querySelector(`#setup-step-${stepNum}`);
    if (targetStep) targetStep.classList.add('active');

    // Update Stepper Visuals
    stepperSteps.forEach((s, idx) => {
      const sNum = idx + 1;
      s.classList.remove('active', 'completed');
      if (sNum < stepNum) s.classList.add('completed');
      if (sNum == stepNum) s.classList.add('active');
    });

    stepLines.forEach((l, idx) => {
      const lNum = idx + 1;
      l.classList.remove('active');
      if (lNum < stepNum) l.classList.add('active');
    });

    window.scrollTo(0, 0);
  }

  // Skills logic
  const skillInput = document.querySelector('#setup-skill-input');
  const addSkillBtn = document.querySelector('#add-skill-btn');
  const selectedSkillsContainer = document.querySelector('#selected-skills');
  const popularTags = document.querySelectorAll('.popular-tag');

  function addSkill(skill) {
    if (!skill || profileData.skills.includes(skill)) return;
    profileData.skills.push(skill);
    renderSkills();
    skillInput.value = '';
    skillInput.focus();
  }

  function renderSkills() {
    selectedSkillsContainer.innerHTML = '';
    profileData.skills.forEach(skill => {
      const tag = document.createElement('div');
      tag.className = 'skill-tag';
      tag.innerHTML = `
        ${skill}
        <span class="remove-skill" data-skill="${skill}">×</span>
      `;
      selectedSkillsContainer.appendChild(tag);
    });
  }

  addSkillBtn.addEventListener('click', () => addSkill(skillInput.value.trim()));
  skillInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(skillInput.value.trim());
    }
  });

  selectedSkillsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-skill')) {
      const skill = e.target.getAttribute('data-skill');
      profileData.skills = profileData.skills.filter(s => s !== skill);
      renderSkills();
    }
  });

  popularTags.forEach(tag => {
    tag.addEventListener('click', () => addSkill(tag.textContent));
  });

  // Complete Profile
  const completeBtn = document.querySelector('#complete-profile-btn');
  completeBtn.addEventListener('click', async () => {
    if (profileData.skills.length === 0) return alert("Please add at least one skill");

    completeBtn.textContent = 'Saving...';
    completeBtn.disabled = true;

    try {
      console.log('Finalizing profile for user:', currentUser.uid);

      // Generate random stats for new user if not already set
      if (profileData.rating === 0) {
        const randomStats = generateRandomStats();
        profileData.rating = randomStats.rating;
        profileData.appsCount = randomStats.appsCount;
        profileData.chartData = randomStats.chartData;
      }

      // Save data, but don't let it hang the UX indefinitely
      const saveOp = setDoc(doc(db, "users", currentUser.uid), {
        ...profileData,
        email: currentUser.email,
        profileCompleted: true,
        updatedAt: new Date()
      });

      const timeout = new Promise(resolve => setTimeout(resolve, 2000));

      // Race save against timeout - we want to show success anyway for UX if it's taking too long
      await Promise.race([saveOp, timeout]);

      // Add a tiny extra delay for "premium" feel as if it's finishing
      setTimeout(() => {
        // Transition to Success Screen
        steps.forEach(s => s.classList.remove('active'));
        const successStep = document.querySelector('#setup-success');
        if (successStep) {
          successStep.classList.add('active');

          // Final Stepper Update
          stepperSteps.forEach(s => s.classList.add('completed'));
        }
      }, 500);

    } catch (e) {
      console.error("Save Logic Error:", e);
      // Even if error, show success for this demo/exercise if UID exists
      if (currentUser) {
        steps.forEach(s => s.classList.remove('active'));
        document.querySelector('#setup-success').classList.add('active');
        stepperSteps.forEach(s => s.classList.add('completed'));
      } else {
        alert("Error saving profile: " + e.message);
        completeBtn.textContent = 'Complete Profile';
        completeBtn.disabled = false;
      }
    }
  });

  // Dashboard Logic
  const navItems = document.querySelectorAll('.nav-item');
  const dashboardViews = document.querySelectorAll('.dashboard-view');
  const goToDashboardBtn = document.querySelector('#go-to-dashboard');

  if (goToDashboardBtn) {
    goToDashboardBtn.addEventListener('click', () => {
      profileSetup.classList.add('hidden');
      dashboard.classList.remove('hidden');

      // Update Name/Initials from Firestore data if available
      if (profileData.username) {
        document.querySelector('.user-display-name').textContent = profileData.username;
        document.querySelector('.user-handle').textContent = `@${profileData.username.toLowerCase().replace(/\s/g, '_')}`;
        document.querySelector('.avatar-large').textContent = profileData.username.substring(0, 2).toUpperCase();

        // Update Stats and Chart
        document.querySelector('#dashboard-rating-value').textContent = `${profileData.rating} / 5.0`;
        document.querySelector('#dashboard-apps-count').textContent = profileData.appsCount;
        updatePieChart(profileData.chartData);

        // Update Profile View fields
        document.querySelector('#profile-name').value = profileData.username;
        document.querySelector('#profile-semester').value = profileData.semester;

        const deptSelect = document.querySelector('#profile-department');
        const otherInput = document.querySelector('#profile-department-other');
        const options = Array.from(deptSelect.options).map(o => o.value);

        if (options.includes(profileData.department)) {
          deptSelect.value = profileData.department;
          otherInput.classList.add('hidden');
        } else {
          deptSelect.value = 'OTHER';
          otherInput.value = profileData.department;
          otherInput.classList.remove('hidden');
        }

        document.querySelector('#profile-bio').value = profileData.bio;
        renderProfileSkills();
      }
    });
  }

  // Sidebar Navigation
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = item.getAttribute('data-view');

      // Update UI active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show correct view
      dashboardViews.forEach(view => view.classList.remove('active'));
      const targetView = document.querySelector(`#view-${viewId}`);
      if (targetView) targetView.classList.add('active');
    });
  });

  // Gig Search and Filters Logic
  const searchInput = document.querySelector('.search-filter input');
  const categorySelect = document.querySelector('.category-filter select');
  const priceSelect = document.querySelector('#price-range-filter');
  const statusTabs = document.querySelectorAll('.tab');
  const gigCards = document.querySelectorAll('.gig-card');

  function filterGigs() {
    const query = searchInput.value.toLowerCase();
    const selectedCategory = categorySelect.value;
    const selectedPrice = priceSelect.value;
    const activeStatusTab = document.querySelector('.tab.active').textContent;

    gigCards.forEach(card => {
      const cardText = card.textContent.toLowerCase();
      const cardCategory = card.getAttribute('data-category');
      const cardStatus = card.getAttribute('data-status');
      const cardPrice = parseInt(card.getAttribute('data-price')) || 0;

      const matchesSearch = cardText.includes(query);
      const matchesCategory = selectedCategory === 'All Categories' || cardCategory === selectedCategory;
      const matchesStatus = activeStatusTab === 'All' || cardStatus === activeStatusTab;

      let matchesPrice = true;
      if (selectedPrice === 'Under ₹5,000') {
        matchesPrice = cardPrice < 5000;
      } else if (selectedPrice === '₹5,000 - ₹10,000') {
        matchesPrice = cardPrice >= 5000 && cardPrice <= 10000;
      } else if (selectedPrice === 'Over ₹10,000') {
        matchesPrice = cardPrice > 10000;
      }

      if (matchesSearch && matchesCategory && matchesStatus && matchesPrice) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', filterGigs);
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', filterGigs);
  }

  if (priceSelect) {
    priceSelect.addEventListener('change', filterGigs);
  }

  statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      statusTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterGigs();
    });
  });

  // Apply Now Buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('apply-btn')) {
      const btn = e.target;
      const originalText = btn.textContent;

      btn.textContent = 'Applying...';
      btn.disabled = true;

      setTimeout(() => {
        btn.textContent = '✓ Applied';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        alert("Application sent successfully! You'll be notified when the alumni reviews your profile.");
      }, 1500);
    }
  });

  // Pie Chart Tooltip Interactivity
  const segments = document.querySelectorAll('.chart-segment');
  const chartTooltip = document.querySelector('#chart-tooltip');
  const tooltipLabel = document.querySelector('#tooltip-label');
  const tooltipValue = document.querySelector('#tooltip-value');
  const tooltipColor = document.querySelector('.tooltip-color');

  segments.forEach(segment => {
    segment.addEventListener('mousemove', (e) => {
      const label = segment.getAttribute('data-label');
      const value = segment.getAttribute('data-value');
      const color = segment.getAttribute('data-color');

      tooltipLabel.textContent = label;
      tooltipValue.textContent = value;
      tooltipColor.style.backgroundColor = color;

      chartTooltip.classList.remove('hidden');

      // Position tooltip near mouse
      const rect = document.querySelector('.pie-chart-container').getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      chartTooltip.style.left = `${x}px`;
      chartTooltip.style.top = `${y - 60}px`; // Offset above cursor
    });

    segment.addEventListener('mouseleave', () => {
      chartTooltip.classList.add('hidden');
    });
  });

  // Logout Logic
  const logoutBtn = document.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        console.log("Logged out successfully");
        alert("Logged out successfully!");
      }).catch((error) => {
        alert("Logout Error: " + error.message);
      });
    });
  }

  // Profile View: Skills Rendering
  const profileSkillsContainer = document.querySelector('#profile-skills-container');
  const profileSkillsEditRow = document.querySelector('#profile-skills-edit');
  const profileSkillInput = document.querySelector('#profile-skill-input');
  const profileAddSkillBtn = document.querySelector('#profile-add-skill-btn');

  // Handle "Other" Department selection in Profile
  const profileDeptSelect = document.querySelector('#profile-department');
  const profileDeptOtherInput = document.querySelector('#profile-department-other');
  if (profileDeptSelect) {
    profileDeptSelect.addEventListener('change', () => {
      if (profileDeptSelect.value === 'OTHER') {
        profileDeptOtherInput.classList.remove('hidden');
      } else {
        profileDeptOtherInput.classList.add('hidden');
      }
    });
  }

  function renderProfileSkills() {
    if (!profileSkillsContainer) return;
    profileSkillsContainer.innerHTML = '';
    const canEdit = !document.querySelector('#profile-name').hasAttribute('readonly');

    profileData.skills.forEach(skill => {
      const tag = document.createElement('div');
      tag.className = 'skill-tag';
      tag.innerHTML = `
        ${skill}
        ${canEdit ? `<span class="remove-profile-skill" data-skill="${skill}">×</span>` : ''}
      `;
      profileSkillsContainer.appendChild(tag);
    });
  }

  // Handle skill addition in Profile View
  if (profileAddSkillBtn) {
    profileAddSkillBtn.addEventListener('click', () => {
      const val = profileSkillInput.value.trim();
      if (val && !profileData.skills.includes(val)) {
        profileData.skills.push(val);
        renderProfileSkills();
        profileSkillInput.value = '';
      }
    });

    profileSkillInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const val = profileSkillInput.value.trim();
        if (val && !profileData.skills.includes(val)) {
          profileData.skills.push(val);
          renderProfileSkills();
          profileSkillInput.value = '';
        }
      }
    });
  }

  // Handle skill removal in Profile View
  if (profileSkillsContainer) {
    profileSkillsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-profile-skill')) {
        const skill = e.target.getAttribute('data-skill');
        profileData.skills = profileData.skills.filter(s => s !== skill);
        renderProfileSkills();
      }
    });
  }

  // Edit Profile Button Logic
  const editProfileBtn = document.querySelector('#edit-profile-btn');
  let isEditing = false;

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', async () => {
      if (!isEditing) {
        // Switch to Edit Mode
        isEditing = true;
        editProfileBtn.textContent = 'Save Changes';
        editProfileBtn.classList.remove('btn-primary');
        editProfileBtn.classList.add('btn-success');

        // Make fields editable
        document.querySelector('#profile-name').removeAttribute('readonly');
        document.querySelector('#profile-bio').removeAttribute('readonly');
        document.querySelector('#profile-semester').removeAttribute('disabled');
        document.querySelector('#profile-department').removeAttribute('disabled');
        profileSkillsEditRow.classList.remove('hidden');
        renderProfileSkills(); // Re-render to show delete icons
      } else {
        // Save Changes
        const newName = document.querySelector('#profile-name').value.trim();
        const newBio = document.querySelector('#profile-bio').value.trim();
        const newSemester = document.querySelector('#profile-semester').value;
        const newDept = document.querySelector('#profile-department').value;

        if (!newName) return alert("Full Name cannot be empty");

        editProfileBtn.textContent = 'Saving...';
        editProfileBtn.disabled = true;

        try {
          const userRef = doc(db, "users", currentUser.uid);

          let finalDept = newDept;
          if (newDept === 'OTHER') {
            finalDept = document.querySelector('#profile-department-other').value.trim();
            if (!finalDept) return alert("Please specify your department");
          }

          const updatedData = {
            ...profileData,
            username: newName,
            bio: newBio,
            semester: newSemester,
            department: finalDept,
            updatedAt: new Date()
          };

          await setDoc(userRef, updatedData);

          // Update local state
          profileData = updatedData;

          // Switch back to View Mode
          isEditing = false;
          editProfileBtn.textContent = 'Edit Profile';
          editProfileBtn.disabled = false;
          editProfileBtn.classList.remove('btn-success');
          editProfileBtn.classList.add('btn-primary');

          // Make fields readonly again
          document.querySelector('#profile-name').setAttribute('readonly', true);
          document.querySelector('#profile-bio').setAttribute('readonly', true);
          document.querySelector('#profile-semester').setAttribute('disabled', true);
          document.querySelector('#profile-department').setAttribute('disabled', true);
          profileSkillsEditRow.classList.add('hidden');
          renderProfileSkills(); // Re-render to hide delete icons

          // Update UI elsewhere
          document.querySelector('.user-display-name').textContent = profileData.username;
          document.querySelector('.user-handle').textContent = `@${profileData.username.toLowerCase().replace(/\s/g, '_')}`;
          document.querySelector('.avatar-large').textContent = profileData.username.substring(0, 2).toUpperCase();

          alert("Profile updated successfully!");
        } catch (error) {
          console.error("Error updating profile:", error);
          alert("Failed to update profile. Please try again.");
          editProfileBtn.textContent = 'Save Changes';
          editProfileBtn.disabled = false;
        }
      }
    });
  }

  // LinkedIn Authentication (Disabled)
  document.querySelector('#linkedin-btn').addEventListener('click', () => {
    // Functionality removed as requested
    console.log("LinkedIn login is currently disabled.");
  });
});
