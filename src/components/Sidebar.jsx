// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { ref, onValue, off, get } from 'firebase/database';
import { db } from '../firebase/config';
import './Sidebar.css';

const Sidebar = ({
  user,
  schoolName,
  schoolLogo,
  profilePhoto,
  activeTab,
  sidebarOpen,
  onTabChange,
  onLogout,
  onToggleSidebar
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [friendRequests, setFriendRequests] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unviewedStatus, setUnviewedStatus] = useState(0);
  const [aiUnreadCount, setAiUnreadCount] = useState(0);
  const [izinPendingCount, setIzinPendingCount] = useState(0);

  const getRoleDisplayName = (role) => {
    const names = {
      developer: 'Developer',
      admin: 'Kepala Sekolah',
      wakil_kepala: 'Wakil Kepala Sekolah',
      staff_tu: 'Staff TU',
      guru: 'Guru',
      siswa: 'Siswa'
    };
    return names[role] || role.toUpperCase();
  };

  const getRoleIcon = (role) => {
    const icons = {
      developer: '👨‍💻',
      admin: '👑',
      wakil_kepala: '👔',
      staff_tu: '📋',
      guru: '👨‍🏫',
      siswa: '👨‍🎓'
    };
    return icons[role] || '👤';
  };

  const getRoleColor = (role) => {
    const colors = {
      developer: '#9b59b6',
      admin: '#e74c3c',
      wakil_kepala: '#3498db',
      staff_tu: '#607d8b',
      guru: '#f39c12',
      siswa: '#e67e22'
    };
    return colors[role] || '#7f8c8d';
  };

  // ==================== ROLE PERMISSIONS ====================
  
  const hasFullAccess = () => {
    const fullAccessRoles = ['developer', 'admin', 'wakil_kepala'];
    return fullAccessRoles.includes(user?.role);
  };

  const hasStaffAccess = () => {
    const staffRoles = ['guru', 'staff_tu'];
    return staffRoles.includes(user?.role);
  };

  const isSiswa = () => {
    return user?.role === 'siswa';
  };

  // ==================== AI ACCESS ====================
  const hasAIAccess = () => {
    // Hanya Developer dan Kepala Sekolah (admin) yang bisa akses AI
    const aiAccessRoles = ['developer', 'admin'];
    return aiAccessRoles.includes(user?.role);
  };

  // ==================== IZIN ONLINE ACCESS ====================
  const hasIzinAccess = () => {
    // Semua role bisa akses izin online
    // Tapi view-nya berbeda berdasarkan role
    return user?.role && user?.role !== '';
  };

  // ==================== LOG AKTIVITAS ACCESS ====================
  const hasLogAktivitasAccess = () => {
    // Hanya Developer, Kepala Sekolah (admin), dan Wakil Kepala Sekolah
    const logAccessRoles = ['developer', 'admin', 'wakil_kepala'];
    return logAccessRoles.includes(user?.role);
  };

  // ==================== GET UNREAD COUNTS ====================
  const getUnreadCounts = async () => {
    if (!user?.uid || !db) return;

    try {
      // Get friend requests
      const requestsSnapshot = await get(ref(db, 'friendships/requests'));
      const requests = requestsSnapshot.val();
      if (requests) {
        const pending = Object.values(requests).filter(
          req => req.to === user.uid && req.status === 'pending'
        );
        setFriendRequests(pending.length);
      }

      // Get unread messages
      const inboxSnapshot = await get(ref(db, `chats/${user.uid}/inbox`));
      const inbox = inboxSnapshot.val();
      if (inbox) {
        let total = 0;
        Object.values(inbox).forEach(chat => {
          if (chat.unreadCount) total += chat.unreadCount;
        });
        setUnreadMessages(total);
      }

      // Get unviewed status
      const statusSnapshot = await get(ref(db, 'statuses'));
      const statuses = statusSnapshot.val();
      if (statuses) {
        let unviewed = 0;
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        for (const [userId, userStatuses] of Object.entries(statuses)) {
          if (userId === user.uid) continue;
          
          // Check if friend
          const friendCheck = await get(ref(db, `friendships/list/${user.uid}/${userId}`));
          if (!friendCheck.exists()) continue;
          
          if (userStatuses) {
            for (const [statusId, status] of Object.entries(userStatuses)) {
              if (status.createdAt && (now - status.createdAt) < twentyFourHours) {
                if (!status.viewedBy || !status.viewedBy[user.uid]) {
                  unviewed++;
                }
              }
            }
          }
        }
        setUnviewedStatus(unviewed);
      }

      // Get AI unread count (hanya untuk yang punya akses)
      if (hasAIAccess()) {
        const aiUnreadSnapshot = await get(ref(db, `ai_assistance/${user.uid}/unread`));
        const aiUnread = aiUnreadSnapshot.val();
        if (aiUnread) {
          setAiUnreadCount(aiUnread.count || 0);
        }
      }

      // Get izin pending count
      const izinSnapshot = await get(ref(db, 'izin'));
      const izinData = izinSnapshot.val();
      if (izinData) {
        let pending = 0;
        const userRole = user?.role;
        const userUid = user?.uid;
        
        for (const [key, izin] of Object.entries(izinData)) {
          // Jika siswa, hanya hitung izin miliknya yang pending
          if (userRole === 'siswa') {
            if (izin.siswaUid === userUid && izin.status === 'pending') {
              pending++;
            }
          } 
          // Jika guru/staff/admin/developer, hitung semua izin yang pending (untuk approval)
          else if (['guru', 'staff_tu', 'wakil_kepala', 'admin', 'developer'].includes(userRole)) {
            if (izin.status === 'pending') {
              pending++;
            }
          }
        }
        setIzinPendingCount(pending);
      }
    } catch (error) {
      console.error('Error getting unread counts:', error);
    }
  };

  // ==================== TIME & DATE ====================
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }));
      setCurrentDate(now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }));
    };
    
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ==================== GET UNREAD COUNTS ON MOUNT ====================
  useEffect(() => {
    if (user?.uid && db) {
      getUnreadCounts();

      // Listen for changes
      const requestsRef = ref(db, 'friendships/requests');
      const inboxRef = ref(db, `chats/${user.uid}/inbox`);
      const statusRef = ref(db, 'statuses');
      const izinRef = ref(db, 'izin');
      
      // Setup listeners
      const requestsUnsub = onValue(requestsRef, () => {
        getUnreadCounts();
      });

      const inboxUnsub = onValue(inboxRef, () => {
        getUnreadCounts();
      });

      const statusUnsub = onValue(statusRef, () => {
        getUnreadCounts();
      });

      const izinUnsub = onValue(izinRef, () => {
        getUnreadCounts();
      });

      let aiUnsub = null;
      if (hasAIAccess()) {
        const aiUnreadRef = ref(db, `ai_assistance/${user.uid}/unread`);
        aiUnsub = onValue(aiUnreadRef, (snapshot) => {
          const data = snapshot.val();
          setAiUnreadCount(data?.count || 0);
        });
      }

      return () => {
        off(requestsRef);
        off(inboxRef);
        off(statusRef);
        off(izinRef);
        requestsUnsub();
        inboxUnsub();
        statusUnsub();
        izinUnsub();
        if (aiUnsub) {
          off(ref(db, `ai_assistance/${user.uid}/unread`));
          aiUnsub();
        }
      };
    }
  }, [user?.uid]);

  // ==================== MENU ITEMS ====================
  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard',
      description: 'Dashboard utama',
      icon: '📊'
    },
    { 
      id: 'profile', 
      label: 'Profil',
      description: 'Profil pengguna',
      icon: '👤',
      showForAll: true
    },
    { 
      id: 'status', 
      label: 'Status',
      description: 'Lihat dan bagikan status',
      icon: '📸',
      showForAll: true,
      badge: unviewedStatus
    },
    { 
      id: 'friends', 
      label: 'Teman',
      description: 'Manajemen teman',
      icon: '👥',
      showForAll: true,
      badge: friendRequests
    },
    { 
      id: 'chat', 
      label: 'Chat',
      description: 'Pesan pribadi',
      icon: '💬',
      showForAll: true,
      badge: unreadMessages
    },
    { 
      id: 'attendance', 
      label: 'Absensi Siswa',
      description: 'Lihat absensi siswa',
      icon: '📋'
    },
    { 
      id: 'staff-attendance', 
      label: 'Absensi Staff',
      description: 'Lihat absensi staff',
      icon: '👔',
      requireStaff: true 
    },
    { 
      id: 'students', 
      label: 'Data Siswa',
      description: 'Kelola data siswa',
      icon: '👨‍🎓'
    },
    { 
      id: 'staff', 
      label: 'Data Staff',
      description: 'Kelola data staff',
      icon: '👥',
      requireStaff: true 
    },
    { 
      id: 'users', 
      label: 'Manajemen User',
      description: 'Kelola user',
      icon: '🔐',
      requireStaff: true 
    },
    { 
      id: 'rekap', 
      label: 'Rekap Siswa',
      description: 'Rekapitulasi data siswa',
      icon: '📊',
      requireStaff: true
    },
    // ==================== MENU LOG AKTIVITAS ====================
    { 
      id: 'log-aktivitas', 
      label: 'Log Aktivitas',
      description: 'Lihat log aktivitas sistem',
      icon: '📋',
      requireLogAktivitas: true
    },
    // ==================== MENU IZIN ONLINE ====================
    { 
      id: 'izin', 
      label: 'Izin Online',
      description: 'Ajukan dan kelola izin online',
      icon: '📝',
      requireIzin: true,
      badge: izinPendingCount
    },
    { 
      id: 'config', 
      label: 'Pengaturan',
      description: 'Pengaturan sistem',
      icon: '⚙️',
      requireAdmin: true 
    }
  ];

  // ==================== AI MENU ITEM (Terpisah) ====================
  // Menu AI Assistant hanya untuk Developer dan Kepala Sekolah
  const aiMenuItem = {
    id: 'ai-assistant',
    label: 'AI Assistant',
    description: 'Asisten AI untuk membantu pengelolaan data',
    icon: '🤖',
    requireAI: true,
    badge: aiUnreadCount
  };

  // ==================== RENDER ====================
  
  // Gabungkan menu items dengan AI jika user memiliki akses
  const allMenuItems = [...menuItems];
  if (hasAIAccess()) {
    // Sisipkan AI Assistant setelah Rekap atau sebelum Config
    const rekapIndex = allMenuItems.findIndex(item => item.id === 'rekap');
    const configIndex = allMenuItems.findIndex(item => item.id === 'config');
    const insertIndex = rekapIndex !== -1 ? rekapIndex + 1 : configIndex;
    allMenuItems.splice(insertIndex, 0, aiMenuItem);
  }

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={onToggleSidebar}></div>}
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* ===== HEADER ===== */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {schoolLogo ? (
              <img src={schoolLogo} alt="Logo Sekolah" className="sidebar-logo-img" />
            ) : (
              <span className="sidebar-logo-icon">📱</span>
            )}
            <h2 className="sidebar-school-name">{schoolName}</h2>
          </div>
          <button className="sidebar-close" onClick={onToggleSidebar} aria-label="Close sidebar">
            ✖
          </button>
        </div>
        
        {/* ===== USER PROFILE ===== */}
        <div className="sidebar-user">
          <div className="sidebar-avatar-wrapper">
            <div className="sidebar-avatar">
              <img 
                src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nama || 'User')}&background=00bcd4&color=fff&size=120&bold=true`} 
                alt="Avatar"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nama?.charAt(0) || 'U')}&background=00bcd4&color=fff&size=120&bold=true`;
                }}
              />
            </div>
            <div className="sidebar-user-status" style={{ background: getRoleColor(user?.role) }}></div>
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.nama || user?.email || 'User'}</div>
            <div className={`sidebar-user-role role-${user?.role}`}>
              {getRoleIcon(user?.role)} {getRoleDisplayName(user?.role)}
            </div>
            {user?.kelas && (
              <div className="sidebar-user-class">📚 {user.kelas}</div>
            )}
            {user?.jurusan && (
              <div className="sidebar-user-major">🎓 {user.jurusan}</div>
            )}
            {/* Badge AI Access untuk Developer dan Admin */}
            {hasAIAccess() && (
              <div className="sidebar-ai-badge" style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                fontSize: '9px',
                padding: '1px 10px',
                borderRadius: '10px',
                fontWeight: 'bold',
                marginTop: '2px'
              }}>
                🤖 AI Access
              </div>
            )}
          </div>
        </div>

        {/* ===== DATE & TIME ===== */}
        <div className="sidebar-datetime">
          <div className="sidebar-time">{currentTime}</div>
          <div className="sidebar-date">{currentDate}</div>
        </div>
        
        {/* ===== NAVIGATION ===== */}
        <nav className="sidebar-nav">
          {allMenuItems.map((item) => {
            let shouldShow = true;

            if (item.showForAll) {
              shouldShow = true;
            } else if (item.requireAdmin) {
              shouldShow = user?.role === 'developer' || user?.role === 'admin';
            } else if (item.requireStaff) {
              const staffRoles = ['developer', 'admin', 'wakil_kepala', 'guru', 'staff_tu'];
              shouldShow = staffRoles.includes(user?.role);
            } else if (item.requireAI) {
              shouldShow = hasAIAccess();
            } else if (item.requireIzin) {
              // ⭐ IZIN ONLINE - Semua role bisa akses ⭐
              shouldShow = hasIzinAccess();
            } else if (item.requireLogAktivitas) {
              // ⭐ LOG AKTIVITAS - Hanya Developer, Kepala Sekolah, dan Wakil Kepala Sekolah ⭐
              shouldShow = hasLogAktivitasAccess();
            } else if (isSiswa()) {
              const studentMenus = ['dashboard', 'profile', 'status', 'friends', 'chat', 'attendance', 'students', 'rekap', 'izin'];
              shouldShow = studentMenus.includes(item.id);
            } else {
              shouldShow = true;
            }

            if (!shouldShow) return null;
            
            const isActive = activeTab === item.id;
            const badgeCount = item.id === 'friends' ? friendRequests : 
                              item.id === 'chat' ? unreadMessages : 
                              item.id === 'status' ? unviewedStatus :
                              item.id === 'ai-assistant' ? aiUnreadCount :
                              item.id === 'izin' ? izinPendingCount :
                              item.badge || 0;
            
            return (
              <button 
                key={item.id}
                className={`sidebar-btn ${isActive ? 'active' : ''} ${item.id === 'ai-assistant' ? 'ai-menu-item' : ''} ${item.id === 'status' ? 'status-menu-item' : ''} ${item.id === 'izin' ? 'izin-menu-item' : ''} ${item.id === 'log-aktivitas' ? 'log-aktivitas-menu-item' : ''}`}
                onClick={() => { 
                  onTabChange(item.id); 
                  if (window.innerWidth <= 768) {
                    onToggleSidebar();
                  }
                }}
                title={item.description}
              >
                <span className="sidebar-btn-icon">{item.icon || '📄'}</span>
                <span className="sidebar-btn-label">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="sidebar-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
                )}
                {isActive && <span className="sidebar-btn-indicator"></span>}
                {item.id === 'status' && badgeCount > 0 && (
                  <span className="status-pulse" style={{
                    position: 'absolute',
                    right: '8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ff6b6b',
                    animation: 'pulse-dot 1.5s infinite'
                  }}></span>
                )}
                {item.id === 'ai-assistant' && (
                  <span className="ai-menu-glow" style={{
                    position: 'absolute',
                    right: '8px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    animation: 'pulse-dot 2s infinite'
                  }}></span>
                )}
                {item.id === 'izin' && badgeCount > 0 && (
                  <span className="izin-pulse" style={{
                    position: 'absolute',
                    right: '8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ff9800',
                    animation: 'pulse-dot 1.5s infinite'
                  }}></span>
                )}
                {item.id === 'log-aktivitas' && (
                  <span className="log-aktivitas-icon" style={{
                    position: 'absolute',
                    right: '8px',
                    fontSize: '10px'
                  }}>📊</span>
                )}
              </button>
            );
          })}
        </nav>
        
        {/* ===== SOCIAL SUMMARY ===== */}
        <div className="sidebar-social-summary">
          <div className={`social-summary-item ${friendRequests > 0 ? 'has-notification' : ''}`} title="Permintaan teman">
            <span className="social-summary-icon">👥</span>
            <span className="social-summary-count" data-count={friendRequests}>{friendRequests}</span>
            <span className="social-summary-label">Teman</span>
          </div>
          <div className={`social-summary-item ${unreadMessages > 0 ? 'has-notification' : ''}`} title="Pesan belum dibaca">
            <span className="social-summary-icon">💬</span>
            <span className="social-summary-count" data-count={unreadMessages}>{unreadMessages}</span>
            <span className="social-summary-label">Chat</span>
          </div>
          <div className={`social-summary-item ${unviewedStatus > 0 ? 'has-notification' : ''}`} title="Status belum dilihat">
            <span className="social-summary-icon">📸</span>
            <span className="social-summary-count" data-count={unviewedStatus}>{unviewedStatus}</span>
            <span className="social-summary-label">Status</span>
          </div>
          {/* Izin Online di Social Summary */}
          <div className={`social-summary-item ${izinPendingCount > 0 ? 'has-notification' : ''}`} 
               title="Izin pending" 
               style={{ cursor: 'pointer' }} 
               onClick={() => {
                 onTabChange('izin');
                 if (window.innerWidth <= 768) onToggleSidebar();
               }}
          >
            <span className="social-summary-icon">📝</span>
            <span className="social-summary-count" data-count={izinPendingCount}>{izinPendingCount}</span>
            <span className="social-summary-label">Izin</span>
          </div>
          {hasAIAccess() && (
            <div className={`social-summary-item ${aiUnreadCount > 0 ? 'has-notification' : ''}`} 
                 title="Pesan AI belum dibaca" 
                 style={{ cursor: 'pointer' }} 
                 onClick={() => {
                   onTabChange('ai-assistant');
                   if (window.innerWidth <= 768) onToggleSidebar();
                 }}
            >
              <span className="social-summary-icon">🤖</span>
              <span className="social-summary-count" data-count={aiUnreadCount}>{aiUnreadCount}</span>
              <span className="social-summary-label">AI</span>
            </div>
          )}
          {/* Log Aktivitas di Social Summary - Hanya untuk yang punya akses */}
          {hasLogAktivitasAccess() && (
            <div className={`social-summary-item`} 
                 title="Log Aktivitas" 
                 style={{ cursor: 'pointer' }} 
                 onClick={() => {
                   onTabChange('log-aktivitas');
                   if (window.innerWidth <= 768) onToggleSidebar();
                 }}
            >
              <span className="social-summary-icon">📋</span>
              <span className="social-summary-count">0</span>
              <span className="social-summary-label">Log</span>
            </div>
          )}
        </div>
        
        {/* ===== FOOTER ===== */}
        <div className="sidebar-footer">
          <div className="sidebar-user-role-info">
            <span className="role-info-label">Role:</span>
            <span className={`role-info-value role-${user?.role}`}>
              {getRoleIcon(user?.role)} {getRoleDisplayName(user?.role)}
            </span>
          </div>
          
          <div className="sidebar-version">
            <span>📱 v6.3</span>
          </div>
          
          <button className="sidebar-logout" onClick={onLogout}>
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;