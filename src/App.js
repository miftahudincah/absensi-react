// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase/config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get, onValue, off } from 'firebase/database';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import AIAssistantPage from './pages/AiAssistantPage';
import LogAktivitas from './pages/tabs/LogAktivitas'; // ✅ PERBAIKAN: import dari pages/tabs
import './App.css';

// ==================== IMPORT ATTENDANCE REMINDER ====================
import attendanceReminder from './utils/AttendanceReminder';

// ==================== IMPORT LOGGER ====================


// Konfigurasi API
const API_BASE_URL = 'https://backendtest-azure.vercel.app';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [reminderInitialized, setReminderInitialized] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiUnreadCount, setAiUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  
  // ==================== IZIN STATE ====================
  const [izinPendingCount, setIzinPendingCount] = useState(0);
  const [izinInitialized, setIzinInitialized] = useState(false);

  // ==================== LOG AKTIVITAS STATE ====================
  const [logActivityInitialized, setLogActivityInitialized] = useState(false);

  // ==================== CHECK AI ACCESS ====================
  // ✅ HANYA Developer dan Admin (Kepala Sekolah) yang bisa akses AI
  const hasAIAccess = useCallback((userData) => {
    const aiAccessRoles = ['developer', 'admin'];
    return aiAccessRoles.includes(userData?.role);
  }, []);

  // ==================== CHECK IZIN ACCESS ====================
  // ✅ Semua user login bisa akses izin
  const hasIzinAccess = useCallback((userData) => {
    return !!userData?.uid;
  }, []);

  // ==================== CHECK LOG AKTIVITAS ACCESS ====================
  // ✅ Hanya Developer, Admin (Kepala Sekolah), dan Wakil Kepala Sekolah
  const hasLogAktivitasAccess = useCallback((userData) => {
    const logAccessRoles = ['developer', 'admin', 'wakil_kepala'];
    return logAccessRoles.includes(userData?.role);
  }, []);

  // ==================== TOKEN MANAGEMENT ====================
  
  const verifyToken = useCallback(async (token) => {
    if (!token) return false;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        console.log('✅ Token verified with backend');
        return true;
      } else {
        console.warn('⚠️ Token verification failed');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Token verification error:', error.message);
      return false;
    }
  }, []);

  const getFreshToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    
    try {
      const token = await auth.currentUser.getIdToken(true);
      localStorage.setItem('authToken', token);
      console.log('✅ Fresh token obtained from Firebase');
      return token;
    } catch (error) {
      console.error('❌ Failed to get fresh token:', error);
      return null;
    }
  }, []);

  const refreshTokenPeriodically = useCallback(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken(true);
          localStorage.setItem('authToken', token);
          console.log('🔄 Token refreshed automatically');
        } catch (error) {
          console.error('❌ Failed to refresh token:', error);
        }
      }
    }, 50 * 60 * 1000);
    
    return interval;
  }, []);

  // ==================== USER MANAGEMENT ====================
  
  const loadUserData = useCallback(async (uid) => {
    try {
      const snapshot = await get(ref(db, `users_auth/${uid}`));
      const userData = snapshot.val();
      
      if (userData) {
        const validRoles = ['developer', 'admin', 'wakil_kepala', 'staff_tu', 'guru', 'siswa'];
        if (!userData.role || !validRoles.includes(userData.role)) {
          userData.role = 'siswa';
        }
        
        if (userData.email === 'zaki5go@gmail.com' && userData.role !== 'developer') {
          userData.role = 'developer';
        }
        
        return {
          uid: uid,
          ...userData
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      return null;
    }
  }, []);

  const setUserAndSave = useCallback((userData) => {
    if (userData) {
      const userToSave = {
        uid: userData.uid,
        email: userData.email,
        nama: userData.nama || userData.email?.split('@')[0] || 'User',
        role: userData.role || 'siswa',
        kelas: userData.kelas || '',
        jurusan: userData.jurusan || '',
        fpId: userData.fpId || null,
        photoUrl: userData.photoUrl || '',
        subject: userData.subject || '',
        bidang: userData.bidang || '',
        noHp: userData.noHp || '',
        parentPhone: userData.parentPhone || '',
        registeredAt: userData.registeredAt || Date.now()
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userToSave));
      setUser(userToSave);
      
      // Set currentUser untuk logger
      if (typeof window !== 'undefined') {
        window.currentUser = userToSave;
      }
      
      window.dispatchEvent(new CustomEvent('userLoggedIn', { 
        detail: { user: userToSave } 
      }));
      
      console.log('✅ User set and saved:', userToSave.nama);
    } else {
      localStorage.removeItem('currentUser');
      if (typeof window !== 'undefined') {
        window.currentUser = null;
      }
      setUser(null);
    }
  }, []);

  // ==================== AI ASSISTANT FUNCTIONS ====================
  
  const openAIAssistant = useCallback(() => {
    if (!hasAIAccess(user)) {
      window.alert('❌ Fitur AI Assistant hanya untuk Developer dan Kepala Sekolah!');
      return;
    }
    setShowAIModal(true);
    setActiveTab('ai-assistant');
  }, [user, hasAIAccess]);

  const closeAIAssistant = useCallback(() => {
    setShowAIModal(false);
    if (activeTab === 'ai-assistant') {
      setActiveTab('dashboard');
    }
  }, [activeTab]);

  const toggleAIAssistant = useCallback(() => {
    if (showAIModal) {
      closeAIAssistant();
    } else {
      openAIAssistant();
    }
  }, [showAIModal, openAIAssistant, closeAIAssistant]);

  // ==================== AI ASSISTANT INITIALIZATION ====================
  
  const initializeAIAssistant = useCallback(async (userData) => {
    if (aiInitialized) {
      console.log('🤖 AI Assistant already initialized');
      return;
    }

    if (!userData && user) {
      userData = user;
    }

    if (!userData || !hasAIAccess(userData)) {
      console.log('🤖 User does not have AI access');
      return;
    }

    try {
      console.log('🤖 Initializing AI Assistant for user:', userData.nama);
      
      if (typeof window !== 'undefined') {
        window.currentUser = userData;
        window.openAIAssistantModal = openAIAssistant;
        window.closeAIAssistantModal = closeAIAssistant;
        window.toggleAIAssistantModal = toggleAIAssistant;
      }
      
      setAiInitialized(true);
      
      window.dispatchEvent(new CustomEvent('aiInitialized', { 
        detail: { user: userData } 
      }));
      
      // ===== LISTEN FOR AI UNREAD COUNT =====
      if (userData?.uid) {
        const aiUnreadRef = ref(db, `ai_assistance/${userData.uid}/unread`);
        const unsubscribe = onValue(aiUnreadRef, (snapshot) => {
          const data = snapshot.val();
          const count = data?.count || 0;
          setAiUnreadCount(count);
          
          window.dispatchEvent(new CustomEvent('aiStatusUpdate', {
            detail: { unreadCount: count }
          }));
        });
        
        if (window._aiUnreadUnsubscribe) {
          window._aiUnreadUnsubscribe();
        }
        window._aiUnreadUnsubscribe = unsubscribe;
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Assistant:', error);
    }
  }, [aiInitialized, hasAIAccess, user, openAIAssistant, closeAIAssistant, toggleAIAssistant]);

  // ==================== IZIN INITIALIZATION ====================
  
  const initializeIzin = useCallback(async (userData) => {
    if (izinInitialized) {
      console.log('📝 Izin system already initialized');
      return;
    }

    if (!userData && user) {
      userData = user;
    }

    if (!userData || !hasIzinAccess(userData)) {
      console.log('📝 User does not have izin access');
      return;
    }

    try {
      console.log('📝 Initializing Izin system for user:', userData.nama);
      
      // ===== LISTEN FOR IZIN PENDING COUNT =====
      const izinRef = ref(db, 'izin');
      const unsubscribe = onValue(izinRef, (snapshot) => {
        const data = snapshot.val();
        let pending = 0;
        
        if (data) {
          const userRole = userData?.role;
          const userUid = userData?.uid;
          const userFpId = userData?.fpId;
          
          for (const [key, izin] of Object.entries(data)) {
            // Jika siswa, hanya hitung izin miliknya yang pending
            if (userRole === 'siswa') {
              if (izin.studentId == userUid || izin.studentId == userFpId) {
                if (izin.status === 'pending') pending++;
              }
            } 
            // Jika guru/staff/admin/developer, hitung semua izin yang pending
            else if (['guru', 'staff_tu', 'wakil_kepala', 'admin', 'developer'].includes(userRole)) {
              if (izin.status === 'pending') pending++;
            }
          }
        }
        
        setIzinPendingCount(pending);
        
        // Dispatch event untuk update badge
        window.dispatchEvent(new CustomEvent('izinBadgeUpdate', {
          detail: { count: pending }
        }));
      });
      
      if (window._izinUnsubscribe) {
        window._izinUnsubscribe();
      }
      window._izinUnsubscribe = unsubscribe;
      
      setIzinInitialized(true);
      console.log('✅ Izin system initialized, pending count:', izinPendingCount);
      
    } catch (error) {
      console.error('❌ Failed to initialize Izin system:', error);
    }
  }, [izinInitialized, user, hasIzinAccess]);

  // ==================== LOG AKTIVITAS INITIALIZATION ====================
  
  const initializeLogActivity = useCallback(async (userData) => {
    if (logActivityInitialized) {
      console.log('📋 Log Aktivitas already initialized');
      return;
    }

    if (!userData && user) {
      userData = user;
    }

    if (!userData || !hasLogAktivitasAccess(userData)) {
      console.log('📋 User does not have Log Aktivitas access');
      return;
    }

    try {
      console.log('📋 Initializing Log Aktivitas system for user:', userData.nama);
      
      // Set currentUser untuk logger
      if (typeof window !== 'undefined') {
        window.currentUser = userData;
      }
      
      // Catat aktivitas login
      if (typeof window.logActivity === 'function') {
        await window.logActivity('login', `User ${userData.nama} (${userData.role}) login`);
      }
      
      setLogActivityInitialized(true);
      console.log('✅ Log Aktivitas system initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Log Aktivitas:', error);
    }
  }, [logActivityInitialized, user, hasLogAktivitasAccess]);

  // ==================== INITIALIZE ATTENDANCE REMINDER ====================
  
  const initializeAttendanceReminder = useCallback(async () => {
    if (reminderInitialized) {
      console.log('⏰ Attendance reminder already initialized');
      return;
    }

    try {
      console.log('⏰ Auto-initializing attendance reminder system...');
      
      const configSnapshot = await get(ref(db, 'system_config/attendance_reminder'));
      const config = configSnapshot.val();
      
      const isEnabled = config?.enabled !== false;
      
      if (!isEnabled) {
        console.log('⏰ Attendance reminder is disabled in system config');
        return;
      }

      attendanceReminder.start();
      setReminderInitialized(true);
      
      console.log('✅ Attendance reminder initialized successfully');
      
      setTimeout(() => {
        attendanceReminder.checkAndSendReminders();
      }, 3000);
      
      if (typeof window.logActivity === 'function') {
        window.logActivity('reminder_init', 'Attendance reminder system started');
      }
    } catch (error) {
      console.error('❌ Failed to initialize attendance reminder:', error);
    }
  }, [reminderInitialized]);

  // ==================== HANDLE TAB CHANGE ====================
  
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    
    if (tab === 'ai-assistant' && hasAIAccess(user)) {
      setShowAIModal(true);
    } else if (tab === 'izin') {
      // Inisialisasi izin jika belum
      if (!izinInitialized && user) {
        initializeIzin(user);
      }
      setShowAIModal(false);
    } else if (tab === 'log-aktivitas') {
      // Inisialisasi log aktivitas jika belum
      if (!logActivityInitialized && user && hasLogAktivitasAccess(user)) {
        initializeLogActivity(user);
      }
      setShowAIModal(false);
    } else if (tab !== 'ai-assistant') {
      setShowAIModal(false);
    }
    
    // Dispatch event untuk tab change
    window.dispatchEvent(new CustomEvent('tabChange', {
      detail: { tab }
    }));
  }, [user, hasAIAccess, izinInitialized, initializeIzin, logActivityInitialized, hasLogAktivitasAccess, initializeLogActivity]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // ==================== AUTH STATE MANAGEMENT ====================
  
  useEffect(() => {
    console.log('🔐 App initializing...');
    
    let isMounted = true;
    let tokenRefreshInterval = null;

    console.log('⏰ [AUTO] Starting attendance reminder system...');
    
    setTimeout(() => {
      if (isMounted && !reminderInitialized) {
        initializeAttendanceReminder();
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;
      
      console.log('🔐 Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      
      if (firebaseUser) {
        try {
          let token = localStorage.getItem('authToken');
          
          if (token) {
            const isValid = await verifyToken(token);
            if (!isValid) {
              console.log('🔄 Token invalid, getting fresh token...');
              token = await getFreshToken();
            }
          } else {
            console.log('🔄 No token, getting fresh token...');
            token = await getFreshToken();
          }
          
          if (!token) {
            console.warn('⚠️ No token available, but continuing...');
          }
          
          const userData = await loadUserData(firebaseUser.uid);
          
          if (userData) {
            if (!userData.email) {
              userData.email = firebaseUser.email || '';
            }
            
            if (userData.email) {
              if (typeof window.resetLoginAttempts === 'function') {
                window.resetLoginAttempts(userData.email);
              }
              localStorage.removeItem('lastLoginEmail');
            }
            
            setUserAndSave(userData);
            
            // Initialize AI Assistant if user has access
            if (hasAIAccess(userData)) {
              setTimeout(() => {
                initializeAIAssistant(userData);
              }, 1500);
            }
            
            // ⭐ INITIALIZE IZIN if user has access ⭐
            if (hasIzinAccess(userData)) {
              setTimeout(() => {
                initializeIzin(userData);
              }, 1800);
            }
            
            // ⭐ INITIALIZE LOG AKTIVITAS if user has access ⭐
            if (hasLogAktivitasAccess(userData)) {
              setTimeout(() => {
                initializeLogActivity(userData);
              }, 2000);
            }
            
            if (tokenRefreshInterval) {
              clearInterval(tokenRefreshInterval);
            }
            tokenRefreshInterval = refreshTokenPeriodically();
            
            console.log('✅ User authenticated:', userData.nama);
          } else {
            console.warn('⚠️ No user data found for uid:', firebaseUser.uid);
            await handleLogout();
          }
        } catch (error) {
          console.error('❌ Auth state handling error:', error);
          await handleLogout();
        }
      } else {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        if (typeof window !== 'undefined') {
          window.currentUser = null;
        }
        setUser(null);
        setAiInitialized(false);
        setIzinInitialized(false);
        setLogActivityInitialized(false);
        setShowAIModal(false);
        setActiveTab('dashboard');
        setIzinPendingCount(0);
        
        if (window._aiUnreadUnsubscribe) {
          window._aiUnreadUnsubscribe();
          window._aiUnreadUnsubscribe = null;
        }
        
        if (window._izinUnsubscribe) {
          window._izinUnsubscribe();
          window._izinUnsubscribe = null;
        }
        
        if (tokenRefreshInterval) {
          clearInterval(tokenRefreshInterval);
          tokenRefreshInterval = null;
        }
        console.log('👤 User signed out');
      }
      
      setAuthChecked(true);
      setLoading(false);
    });

    // ===== LISTEN FOR PAGE EVENTS =====
    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        console.log('👁️ Tab visible - checking reminder...');
        if (!reminderInitialized) {
          initializeAttendanceReminder();
        } else {
          setTimeout(() => {
            attendanceReminder.checkAndSendReminders();
          }, 2000);
        }
        
        if (user && hasAIAccess(user) && aiInitialized) {
          console.log('🤖 Refreshing AI data on tab visibility...');
          if (window.refreshAIDataCache) {
            window.refreshAIDataCache();
          }
        }
        
        // ⭐ Refresh izin data on tab visibility ⭐
        if (user && hasIzinAccess(user) && izinInitialized) {
          console.log('📝 Refreshing izin data on tab visibility...');
          if (window._izinUnsubscribe) {
            // Re-trigger listener by re-fetching
            const izinRef = ref(db, 'izin');
            onValue(izinRef, (snapshot) => {
              const data = snapshot.val();
              let pending = 0;
              if (data) {
                const userRole = user?.role;
                const userUid = user?.uid;
                const userFpId = user?.fpId;
                for (const [key, izin] of Object.entries(data)) {
                  if (userRole === 'siswa') {
                    if (izin.studentId == userUid || izin.studentId == userFpId) {
                      if (izin.status === 'pending') pending++;
                    }
                  } else if (['guru', 'staff_tu', 'wakil_kepala', 'admin', 'developer'].includes(userRole)) {
                    if (izin.status === 'pending') pending++;
                  }
                }
              }
              setIzinPendingCount(pending);
              window.dispatchEvent(new CustomEvent('izinBadgeUpdate', {
                detail: { count: pending }
              }));
            }, { onlyOnce: true });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleWindowFocus = () => {
      if (isMounted) {
        console.log('🔄 Window focused - checking reminder...');
        if (!reminderInitialized) {
          initializeAttendanceReminder();
        }
        
        if (user && hasAIAccess(user) && aiInitialized) {
          console.log('🤖 Refreshing AI data on window focus...');
          if (window.refreshAIDataCache) {
            window.refreshAIDataCache();
          }
        }
        
        // ⭐ Refresh izin data on window focus ⭐
        if (user && hasIzinAccess(user) && izinInitialized) {
          console.log('📝 Refreshing izin data on window focus...');
          if (window._izinUnsubscribe) {
            const izinRef = ref(db, 'izin');
            onValue(izinRef, (snapshot) => {
              const data = snapshot.val();
              let pending = 0;
              if (data) {
                const userRole = user?.role;
                const userUid = user?.uid;
                const userFpId = user?.fpId;
                for (const [key, izin] of Object.entries(data)) {
                  if (userRole === 'siswa') {
                    if (izin.studentId == userUid || izin.studentId == userFpId) {
                      if (izin.status === 'pending') pending++;
                    }
                  } else if (['guru', 'staff_tu', 'wakil_kepala', 'admin', 'developer'].includes(userRole)) {
                    if (izin.status === 'pending') pending++;
                  }
                }
              }
              setIzinPendingCount(pending);
              window.dispatchEvent(new CustomEvent('izinBadgeUpdate', {
                detail: { count: pending }
              }));
            }, { onlyOnce: true });
          }
        }
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    const handleUserLoggedIn = async (e) => {
      if (e.detail && e.detail.user) {
        console.log('✅ User logged in event received:', e.detail.user.nama);
        
        let token = localStorage.getItem('authToken');
        if (!token && auth.currentUser) {
          token = await getFreshToken();
        }
        
        setUserAndSave(e.detail.user);
        
        if (hasAIAccess(e.detail.user)) {
          setTimeout(() => {
            initializeAIAssistant(e.detail.user);
          }, 1000);
        }
        
        // ⭐ Initialize izin on login ⭐
        if (hasIzinAccess(e.detail.user)) {
          setTimeout(() => {
            initializeIzin(e.detail.user);
          }, 1300);
        }
        
        // ⭐ Initialize log aktivitas on login ⭐
        if (hasLogAktivitasAccess(e.detail.user)) {
          setTimeout(() => {
            initializeLogActivity(e.detail.user);
          }, 1600);
        }
      }
    };
    window.addEventListener('userLoggedIn', handleUserLoggedIn);

    const handleUserLoggedOut = () => {
      console.log('🚪 User logged out event received');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('login_attempts_data');
      localStorage.removeItem('lastLoginEmail');
      if (typeof window !== 'undefined') {
        window.currentUser = null;
      }
      setUser(null);
      setAiInitialized(false);
      setIzinInitialized(false);
      setLogActivityInitialized(false);
      setShowAIModal(false);
      setActiveTab('dashboard');
      setIzinPendingCount(0);
      
      if (window._aiUnreadUnsubscribe) {
        window._aiUnreadUnsubscribe();
        window._aiUnreadUnsubscribe = null;
      }
      
      if (window._izinUnsubscribe) {
        window._izinUnsubscribe();
        window._izinUnsubscribe = null;
      }
      
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
      }
    };
    window.addEventListener('userLoggedOut', handleUserLoggedOut);

    const handleAIInitRequest = () => {
      if (user && hasAIAccess(user) && !aiInitialized) {
        console.log('🤖 AI initialization requested via event');
        initializeAIAssistant(user);
      }
    };
    window.addEventListener('initializeAI', handleAIInitRequest);

    const handleOpenAIRequest = () => {
      if (user && hasAIAccess(user)) {
        console.log('🤖 Open AI requested via event');
        openAIAssistant();
      }
    };
    window.addEventListener('openAIAssistant', handleOpenAIRequest);

    // ===== LISTEN FOR TAB CHANGE =====
    const handleTabChangeEvent = (e) => {
      if (e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('tabChange', handleTabChangeEvent);

    // ===== LISTEN FOR IZIN BADGE UPDATE =====
    const handleIzinBadgeUpdate = (e) => {
      if (e.detail && typeof e.detail.count === 'number') {
        setIzinPendingCount(e.detail.count);
      }
    };
    window.addEventListener('izinBadgeUpdate', handleIzinBadgeUpdate);

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser && !auth.currentUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log('📦 Saved user found:', userData.nama);
      } catch (e) {
        console.warn('Failed to parse saved user:', e);
        localStorage.removeItem('currentUser');
      }
    }

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('userLoggedIn', handleUserLoggedIn);
      window.removeEventListener('userLoggedOut', handleUserLoggedOut);
      window.removeEventListener('initializeAI', handleAIInitRequest);
      window.removeEventListener('openAIAssistant', handleOpenAIRequest);
      window.removeEventListener('tabChange', handleTabChangeEvent);
      window.removeEventListener('izinBadgeUpdate', handleIzinBadgeUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      
      if (window._aiUnreadUnsubscribe) {
        window._aiUnreadUnsubscribe();
        window._aiUnreadUnsubscribe = null;
      }
      
      if (window._izinUnsubscribe) {
        window._izinUnsubscribe();
        window._izinUnsubscribe = null;
      }
      
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
      
      console.log('🧹 App cleanup complete');
    };
  }, [loadUserData, setUserAndSave, verifyToken, getFreshToken, refreshTokenPeriodically, initializeAttendanceReminder, reminderInitialized, initializeAIAssistant, hasAIAccess, user, aiInitialized, openAIAssistant, initializeIzin, hasIzinAccess, izinInitialized, hasLogAktivitasAccess, initializeLogActivity, logActivityInitialized]);

  // ==================== HANDLERS ====================
  
  const handleLoginSuccess = useCallback((userData) => {
    console.log('✅ Login success, setting user:', userData.nama);
    setUserAndSave(userData);
    
    // ⭐ Initialize izin on login success ⭐
    if (hasIzinAccess(userData)) {
      setTimeout(() => {
        initializeIzin(userData);
      }, 1000);
    }
    
    // ⭐ Initialize log aktivitas on login success ⭐
    if (hasLogAktivitasAccess(userData)) {
      setTimeout(() => {
        initializeLogActivity(userData);
      }, 1300);
    }
  }, [setUserAndSave, hasIzinAccess, initializeIzin, hasLogAktivitasAccess, initializeLogActivity]);

  const handleLogout = useCallback(async () => {
    console.log('🚪 Logging out...');
    
    try {
      // Catat aktivitas logout jika logActivity tersedia
      if (typeof window.logActivity === 'function' && user) {
        await window.logActivity('logout', `User ${user.nama} (${user.role}) logout`);
      }
      
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('login_attempts_data');
      localStorage.removeItem('lastLoginEmail');
      
      if (typeof window !== 'undefined') {
        window.currentUser = null;
      }
      
      if (window._aiUnreadUnsubscribe) {
        window._aiUnreadUnsubscribe();
        window._aiUnreadUnsubscribe = null;
      }
      
      if (window._izinUnsubscribe) {
        window._izinUnsubscribe();
        window._izinUnsubscribe = null;
      }
      
      if (window._lockoutInterval) {
        clearInterval(window._lockoutInterval);
        window._lockoutInterval = null;
      }
      
      await signOut(auth);
      setUser(null);
      setAiInitialized(false);
      setAiUnreadCount(0);
      setIzinInitialized(false);
      setIzinPendingCount(0);
      setLogActivityInitialized(false);
      setReminderInitialized(false);
      setShowAIModal(false);
      setActiveTab('dashboard');
      
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
      
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }, [user]);

  // ==================== RENDER CONTENT ====================
  
  const renderContent = useCallback(() => {
    if (!user) return null;

    // ===== LOG AKTIVITAS PAGE =====
    if (activeTab === 'log-aktivitas') {
      if (!hasLogAktivitasAccess(user)) {
        return (
          <div className="access-denied">
            <div className="access-denied-content">
              <span className="access-denied-icon">⛔</span>
              <h2>Akses Ditolak</h2>
              <p>Anda tidak memiliki izin untuk mengakses Log Aktivitas.</p>
              <p style={{ fontSize: '14px', color: '#888' }}>
                Fitur ini hanya untuk Developer, Kepala Sekolah, dan Wakil Kepala Sekolah.
              </p>
              <button 
                className="btn-back"
                onClick={() => setActiveTab('dashboard')}
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        );
      }
      
      // Pastikan user sudah di-set untuk logger
      if (typeof window !== 'undefined') {
        window.currentUser = user;
      }
      
      return (
        <div className="log-aktivitas-page">
          <LogAktivitas 
            user={user} 
            logActivity={window.logActivity}
          />
        </div>
      );
    }

    if (activeTab === 'ai-assistant') {
      return <AIAssistantPage user={user} />;
    }
    
    return (
      <Dashboard 
        user={user} 
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
    );
  }, [user, activeTab, handleTabChange, handleLogout, sidebarOpen, toggleSidebar, hasLogAktivitasAccess]);

  // ==================== RENDER ====================
  
  if (loading || !authChecked) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Memuat sistem...</p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
          Menghubungkan ke Firebase...
        </p>
        {aiInitialized && (
          <p style={{ fontSize: '12px', color: 'rgba(99,102,241,0.6)', marginTop: '4px' }}>
            🤖 AI Assistant siap digunakan
          </p>
        )}
        {izinInitialized && (
          <p style={{ fontSize: '12px', color: 'rgba(255,152,0,0.6)', marginTop: '4px' }}>
            📝 Izin Online siap digunakan
          </p>
        )}
        {logActivityInitialized && (
          <p style={{ fontSize: '12px', color: 'rgba(52,152,219,0.6)', marginTop: '4px' }}>
            📋 Log Aktivitas siap digunakan
          </p>
        )}
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {renderContent()}
      
      {/* ===== AI FLOATING BUTTON ===== */}
      {/* HANYA Developer dan Admin (Kepala Sekolah) yang melihat tombol AI */}
      {hasAIAccess(user) && (
        <button 
          className="ai-floating-button"
          onClick={toggleAIAssistant}
          title="AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            zIndex: 9998,
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(99, 102, 241, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
          }}
        >
          {showAIModal ? '✖' : '🤖'}
          {aiUnreadCount > 0 && !showAIModal && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
            }}>
              {aiUnreadCount > 99 ? '99+' : aiUnreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default App;