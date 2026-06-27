// src/pages/tabs/LogAktivitas.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, off, remove, get } from 'firebase/database';
import { db } from '../../firebase/config';
import './LogAktivitas.css';

// ======================= ROLE HELPER FUNCTIONS ========================

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

const getActionIcon = (action) => {
  const icons = {
    'login': '🔓', 'logout': '🚪', 'register': '📝', 'forgot_password': '🔐',
    'create_announcement': '📢', 'update_announcement': '✏️', 'delete_announcement': '🗑️',
    'delete_attendance': '🗑️', 'simulate_attendance_in': '✅', 'simulate_attendance_out': '🏠',
    'save_manual_attendance': '📝', 'export_attendance_excel': '📊',
    'add_student': '➕', 'edit_student': '✏️', 'delete_student': '🗑️',
    'import_students': '📥', 'export_students': '📤',
    'update_user_role': '🔄', 'delete_user': '🗑️', 'reset_system': '⚠️', 'reset_user_password': '🔑',
    'create_status': '📸', 'delete_status': '🗑️',
    'send_friend_request': '➕', 'accept_friend_request': '✅', 'reject_friend_request': '❌', 'remove_friend': '🗑️',
    'delete_chat_message': '💬🗑️', 'clear_chat': '🧹',
    'upload_profile_photo': '📸', 'save_school_name': '🏫', 'upload_school_logo': '🖼️',
    'remove_school_logo': '🗑️', 'update_global_delay': '⏰', 'save_classes': '📚',
    'save_majors': '🎓', 'update_school_type': '🏫',
    'export_rekap_excel': '📊', 'export_rekap_pdf': '📄',
    'add_staff': '➕', 'edit_staff': '✏️', 'delete_staff': '🗑️', 'create_staff_account': '👤',
    'simulate_staff_attendance_in': '✅', 'simulate_staff_attendance_out': '🏠', 'delete_staff_attendance': '🗑️',
    'export_staff_attendance_excel': '📊',
    'create_izin': '📝', 'update_izin': '✏️', 'delete_izin': '🗑️', 'approve_izin': '✅', 'reject_izin': '❌',
    'generate_code': '🔑', 'delete_code': '🗑️',
    'delete_log': '🗑️', 'delete_all_logs': '🔥',
    'change_password': '🔑', 'auto_reminder': '🤖'
  };
  return icons[action] || '📌';
};

const formatActionName = (action) => {
  const names = {
    'login': 'Login', 'logout': 'Logout', 'register': 'Registrasi Akun', 'forgot_password': 'Lupa Password',
    'create_announcement': 'Buat Pengumuman', 'update_announcement': 'Edit Pengumuman', 'delete_announcement': 'Hapus Pengumuman',
    'delete_attendance': 'Hapus Absensi', 'simulate_attendance_in': 'Simulasi Absen Masuk',
    'simulate_attendance_out': 'Simulasi Absen Pulang', 'save_manual_attendance': 'Atur Ketidakhadiran',
    'export_attendance_excel': 'Ekspor Absensi Excel',
    'add_student': 'Tambah Siswa', 'edit_student': 'Edit Siswa', 'delete_student': 'Hapus Siswa',
    'import_students': 'Import Siswa', 'export_students': 'Export Siswa',
    'update_user_role': 'Ubah Role User', 'delete_user': 'Hapus User', 'reset_system': 'Reset Sistem',
    'reset_user_password': 'Reset Password User',
    'create_status': 'Buat Status', 'delete_status': 'Hapus Status',
    'send_friend_request': 'Kirim Permintaan Teman', 'accept_friend_request': 'Terima Permintaan Teman',
    'reject_friend_request': 'Tolak Permintaan Teman', 'remove_friend': 'Hapus Teman',
    'delete_chat_message': 'Hapus Pesan Chat', 'clear_chat': 'Bersihkan Chat',
    'upload_profile_photo': 'Upload Foto Profil', 'save_school_name': 'Ubah Nama Sekolah',
    'upload_school_logo': 'Upload Logo Sekolah', 'remove_school_logo': 'Hapus Logo Sekolah',
    'update_global_delay': 'Ubah Delay Global', 'save_classes': 'Simpan Daftar Kelas',
    'save_majors': 'Simpan Daftar Jurusan', 'update_school_type': 'Ubah Tipe Sekolah',
    'export_rekap_excel': 'Ekspor Rekap Excel', 'export_rekap_pdf': 'Ekspor Rekap PDF',
    'add_staff': 'Tambah Staff', 'edit_staff': 'Edit Staff', 'delete_staff': 'Hapus Staff',
    'create_staff_account': 'Buat Akun Staff', 'simulate_staff_attendance_in': 'Absen Masuk Staff',
    'simulate_staff_attendance_out': 'Absen Pulang Staff', 'delete_staff_attendance': 'Hapus Absensi Staff',
    'export_staff_attendance_excel': 'Ekspor Absensi Staff Excel',
    'create_izin': 'Ajukan Izin', 'update_izin': 'Edit Izin', 'delete_izin': 'Hapus Izin',
    'approve_izin': 'Setujui Izin', 'reject_izin': 'Tolak Izin',
    'generate_code': 'Generate Kode Registrasi', 'delete_code': 'Hapus Kode Registrasi',
    'delete_log': 'Hapus Log', 'delete_all_logs': 'Hapus Semua Log',
    'change_password': 'Ubah Password', 'auto_reminder': 'Pengingat Otomatis'
  };
  return names[action] || action.replace(/_/g, ' ').toUpperCase();
};

const escapeHtmlLog = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
};

// ======================= PERMISSION CHECKS ========================

const canDeleteLogs = (role) => {
  const deleteRoles = ['developer', 'admin'];
  return deleteRoles.includes(role);
};

const canViewAllLogs = (role) => {
  const allAccessRoles = ['admin', 'developer', 'wakil_kepala', 'guru'];
  return allAccessRoles.includes(role);
};

const canViewSensitiveLogs = (role) => {
  const sensitiveRoles = ['admin', 'developer', 'wakil_kepala'];
  return sensitiveRoles.includes(role);
};

const filterSensitiveActionsForStaffTU = (logs) => {
  const sensitiveActions = [
    'delete_user', 'reset_system', 'update_user_role',
    'delete_announcement', 'reset_user_password', 'delete_log', 'delete_all_logs'
  ];
  return logs.filter(log => !sensitiveActions.includes(log.action));
};

// ======================= FILTER DEVELOPER ACTIVITIES ========================
const filterDeveloperActivities = (logs, currentUserRole) => {
  if (currentUserRole === 'developer') {
    return logs;
  }
  
  return logs.filter(log => {
    if (log.userRole === 'developer') {
      return false;
    }
    if (log.userId && log.userId.includes('developer')) {
      return false;
    }
    return true;
  });
};

const getAllowedActionsForFilter = (role) => {
  const allActions = [
    'login', 'logout', 'register',
    'create_announcement', 'update_announcement', 'delete_announcement',
    'delete_attendance', 'simulate_attendance_in', 'simulate_attendance_out', 'save_manual_attendance',
    'add_student', 'edit_student', 'delete_student', 'import_students', 'export_students',
    'update_user_role', 'delete_user', 'reset_system', 'reset_user_password',
    'create_status', 'delete_status',
    'send_friend_request', 'accept_friend_request', 'reject_friend_request', 'remove_friend',
    'delete_chat_message', 'clear_chat',
    'upload_profile_photo', 'save_school_name', 'upload_school_logo', 'remove_school_logo',
    'update_global_delay', 'save_classes', 'save_majors', 'update_school_type',
    'export_attendance_excel', 'export_rekap_excel', 'export_rekap_pdf', 'forgot_password',
    'delete_log', 'delete_all_logs', 'change_password', 'auto_reminder'
  ];

  if (role === 'staff_tu') {
    const sensitiveActions = ['delete_user', 'reset_system', 'update_user_role', 'delete_announcement', 'delete_log', 'delete_all_logs'];
    return allActions.filter(a => !sensitiveActions.includes(a));
  }

  return allActions;
};

const getActionCategories = () => ({
  '🔐 Autentikasi': ['login', 'logout', 'register', 'forgot_password', 'change_password'],
  '📢 Pengumuman': ['create_announcement', 'update_announcement', 'delete_announcement'],
  '📋 Absensi': ['delete_attendance', 'simulate_attendance_in', 'simulate_attendance_out', 'save_manual_attendance', 'export_attendance_excel', 'auto_reminder'],
  '👨‍🎓 Manajemen Siswa': ['add_student', 'edit_student', 'delete_student', 'import_students', 'export_students'],
  '👥 Manajemen User': ['update_user_role', 'delete_user', 'reset_user_password', 'reset_system'],
  '📸 Status': ['create_status', 'delete_status'],
  '👥 Pertemanan': ['send_friend_request', 'accept_friend_request', 'reject_friend_request', 'remove_friend'],
  '💬 Chat': ['delete_chat_message', 'clear_chat'],
  '⚙️ Pengaturan': ['upload_profile_photo', 'save_school_name', 'upload_school_logo', 'remove_school_logo', 'update_global_delay', 'save_classes', 'save_majors', 'update_school_type'],
  '📊 Ekspor': ['export_rekap_excel', 'export_rekap_pdf'],
  '🗑️ Manajemen Log': ['delete_log', 'delete_all_logs']
});

const getRoleBadgeClass = (role) => {
  const classes = {
    developer: 'role-developer',
    admin: 'role-admin',
    wakil_kepala: 'role-wakil-kepala',
    staff_tu: 'role-staff-tu',
    guru: 'role-guru',
    siswa: 'role-siswa'
  };
  return classes[role] || 'role-unknown';
};

// ======================= KOMPONEN UTAMA ========================

const LogAktivitas = ({ user, logActivity, onBack }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(20);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [totalLogs, setTotalLogs] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllText, setDeleteAllText] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const logsRef = useRef(null);
  const logsListener = useRef(null);

  // Role checking (case-insensitive)
  const rawRole = user?.role || 'siswa';
  const role = rawRole.toString().toLowerCase().trim();
  const isSiswa = role === 'siswa';
  const isGuru = role === 'guru';
  const isStaff = role === 'staff_tu';
  const isAdmin = ['developer', 'admin', 'wakil_kepala'].includes(role);
  const isDeveloper = role === 'developer';

  // ======================= HANDLE RESIZE ========================
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 480) {
        setLogsPerPage(10);
      } else if (window.innerWidth <= 768) {
        setLogsPerPage(15);
      } else {
        setLogsPerPage(20);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ======================= SET DEFAULT DATES ========================
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // ======================= FETCH LOGS ========================
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    if (logsListener.current) {
      off(logsRef.current);
      logsListener.current = null;
    }

    logsRef.current = ref(db, 'logs');
    
    logsListener.current = onValue(logsRef.current, (snapshot) => {
      const data = snapshot.val();
      const logsArray = [];
      
      if (data) {
        Object.entries(data).forEach(([id, log]) => {
          logsArray.push({ id, ...log });
        });
      }
      
      logsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLogs(logsArray);
      setLoading(false);
    });

    return () => {
      if (logsListener.current && logsRef.current) {
        off(logsRef.current);
        logsListener.current = null;
      }
    };
  }, [user?.uid]);

  // ======================= FILTER LOGS ========================
  useEffect(() => {
    let filtered = [...logs];
    
    // Filter developer activities
    filtered = filterDeveloperActivities(filtered, user?.role);
    
    if (user?.role === 'siswa') {
      filtered = filtered.filter(log => log.userId === user.uid);
    } else if (user?.role === 'staff_tu') {
      filtered = filterSensitiveActionsForStaffTU(filtered);
    }
    
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(log => {
        const ts = log.timestamp;
        if (!ts) return false;
        const logDate = new Date(ts);
        return logDate >= start && logDate <= end;
      });
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(log => {
        const userName = (log.userName || log.userId || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const role = (log.userRole || '').toLowerCase();
        return userName.includes(term) || 
               action.includes(term) || 
               details.includes(term) ||
               role.includes(term);
      });
    }
    
    setFilteredLogs(filtered);
    setTotalLogs(filtered.length);
    setCurrentPage(1);
  }, [logs, user, actionFilter, startDate, endDate, searchTerm]);

  // ======================= PAGINATION ========================
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, startIndex + logsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    const tableContainer = document.querySelector('.logs-table-container');
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  };

  // ======================= DELETE SINGLE LOG ========================
  const handleDeleteSingle = (log) => {
    setLogToDelete(log);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSingle = async () => {
    if (!logToDelete || !user) return;
    
    setDeleting(true);
    
    try {
      await remove(ref(db, `logs/${logToDelete.id}`));
      
      if (typeof logActivity === 'function') {
        const roleDisplay = getRoleDisplayName(user.role);
        await logActivity('delete_log', `Menghapus log oleh ${logToDelete.userName || logToDelete.userId} (Aksi: ${logToDelete.action}) - ${roleDisplay}`);
      }
      
      setShowDeleteConfirm(false);
      setLogToDelete(null);
      
      if (window.showToast) {
        window.showToast('✅ Log berhasil dihapus!', 'success');
      }
    } catch (error) {
      console.error('Delete log error:', error);
      if (window.showToast) {
        window.showToast(`❌ Gagal menghapus log: ${error.message}`, 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  // ======================= DELETE ALL LOGS ========================
  const handleDeleteAll = () => {
    setDeleteAllConfirm(true);
    setDeleteAllText('');
  };

  const confirmDeleteAll = async () => {
    if (deleteAllText !== 'HAPUS SEMUA') {
      if (window.showToast) {
        window.showToast('❌ Konfirmasi gagal. Ketik "HAPUS SEMUA" dengan benar.', 'error');
      }
      return;
    }
    
    setDeleting(true);
    
    try {
      await remove(ref(db, 'logs'));
      
      if (typeof logActivity === 'function') {
        const roleDisplay = getRoleDisplayName(user.role);
        await logActivity('delete_all_logs', `Menghapus semua log (${totalLogs} log) - ${roleDisplay}`);
      }
      
      setDeleteAllConfirm(false);
      setDeleteAllText('');
      
      if (window.showToast) {
        window.showToast(`✅ ${totalLogs} log berhasil dihapus!`, 'success');
      }
    } catch (error) {
      console.error('Delete all logs error:', error);
      if (window.showToast) {
        window.showToast(`❌ Gagal menghapus log: ${error.message}`, 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  // ======================= EXPORT LOGS ========================
  const handleExportLogs = () => {
    if (filteredLogs.length === 0) {
      if (window.showToast) {
        window.showToast('📭 Tidak ada log untuk diekspor', 'info');
      }
      return;
    }
    
    const headers = ['Waktu', 'Pengguna', 'Role', 'Aksi', 'Detail', 'IP Address'];
    const rows = filteredLogs.map(log => [
      log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-',
      log.userName || log.userId || 'unknown',
      getRoleDisplayName(log.userRole || 'siswa'),
      formatActionName(log.action || 'unknown'),
      (log.details || '-').replace(/,/g, ';'),
      log.ipAddress || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `log_aktivitas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (window.showToast) {
      window.showToast(`📥 ${filteredLogs.length} log diekspor`, 'success');
    }
  };

  // ======================= CLEAR ALL FILTERS ========================
  const handleClearFilters = () => {
    setActionFilter('all');
    setSearchTerm('');
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  // ======================= HANDLE BACK ========================
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    }
  };

  // ======================= RENDER PAGINATION ========================
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      pages.push({ type: 'ellipsis', key: 'start-ellipsis' });
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push({ type: 'page', page: i, key: `page-${i}` });
    }

    if (endPage < totalPages) {
      pages.push({ type: 'ellipsis', key: 'end-ellipsis' });
    }

    return (
      <div className="logs-pagination">
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          aria-label="Halaman pertama"
        >
          ⏮️
        </button>
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Halaman sebelumnya"
        >
          ◀
        </button>
        
        {pages.map((item) => {
          if (item.type === 'ellipsis') {
            return <span key={item.key} className="pagination-ellipsis">…</span>;
          }
          return (
            <button
              key={item.key}
              className={`pagination-number ${currentPage === item.page ? 'active' : ''}`}
              onClick={() => handlePageChange(item.page)}
              aria-label={`Halaman ${item.page}`}
              aria-current={currentPage === item.page ? 'page' : undefined}
            >
              {item.page}
            </button>
          );
        })}
        
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Halaman berikutnya"
        >
          ▶
        </button>
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Halaman terakhir"
        >
          ⏭️
        </button>
        <span className="pagination-info">
          {isMobile ? `${currentPage}/${totalPages}` : `Halaman ${currentPage} dari ${totalPages}`}
        </span>
      </div>
    );
  };

  // ======================= GET ACTION FILTER OPTIONS ========================
  const getActionFilterOptions = () => {
    const allowedActions = getAllowedActionsForFilter(user?.role);
    const categories = getActionCategories();
    const options = [];
    
    options.push({ value: 'all', label: '📌 Semua Aksi', category: null });
    
    for (const [category, actions] of Object.entries(categories)) {
      const categoryActions = actions.filter(a => allowedActions.includes(a));
      if (categoryActions.length > 0) {
        options.push({ 
          value: `__category__${category}`, 
          label: `─── ${category} ───`,
          category: 'divider',
          disabled: true
        });
        categoryActions.forEach(action => {
          options.push({
            value: action,
            label: `${getActionIcon(action)} ${formatActionName(action)}`,
            category
          });
        });
      }
    }
    
    return options;
  };

  // ======================= CAN DELETE ========================
  const canDelete = canDeleteLogs(user?.role);
  const canViewAll = canViewAllLogs(user?.role);

  // ======================= LOADING ========================
  if (loading) {
    return (
      <div className="log-aktivitas-container">
        <div className="logs-loading">
          <div className="loading-spinner"></div>
          <p>⏳ Memuat log aktivitas...</p>
        </div>
      </div>
    );
  }

  // ======================= RENDER ========================
  return (
    <div className="log-aktivitas-container">
      {/* Header dengan Tombol Back yang Jelas */}
      <div className="logs-header">
        <div className="logs-header-left">
          <button 
            className="btn-back-home" 
            onClick={handleBack}
            aria-label="Kembali ke Dashboard"
            title="Kembali ke Dashboard"
          >
            <span className="back-icon">🏠</span>
            <span className="back-text">Kembali ke Dashboard</span>
          </button>
          <div className="header-title-wrapper">
            <h1 className="logs-title-main">📋 Log Aktivitas</h1>
            <p className="logs-subtitle">
              {isSiswa ? 'Log aktivitas Anda' : 
               isGuru ? '👨‍🏫 Log aktivitas semua pengguna' : 
               isStaff ? '👨‍💼 Log aktivitas staff' : 
               isDeveloper ? '💻 Developer - Log lengkap' : 
               '📋 Log aktivitas sistem'}
            </p>
          </div>
        </div>
        <div className="logs-header-right">
          <span className="logs-count-badge">{totalLogs} record</span>
          <button className="btn-export" onClick={handleExportLogs} title="Ekspor ke CSV">
            📥 {isMobile ? 'CSV' : 'Ekspor CSV'}
          </button>
          {canDelete && totalLogs > 0 && (
            <button className="btn-delete-all" onClick={handleDeleteAll} title="Hapus semua log">
              🗑️ {isMobile ? 'Hapus' : 'Hapus Semua Log'}
            </button>
          )}
        </div>
      </div>

      {/* Role Banners */}
      {isDeveloper && (
        <div className="developer-banner-logs">
          <span className="dev-icon">💻</span>
          <div className="dev-info">
            <span className="dev-status">
              Status: <span>Developer Mode</span>
            </span>
            <span className="dev-badge">|</span>
            <span className="dev-badge">👁️ Melihat semua log</span>
            <span className="dev-badge">|</span>
            <span className="dev-badge highlight-red">🗑️ Bisa hapus log</span>
            <span className="dev-badge">|</span>
            <span className="dev-badge highlight-blue">📊 Total: {totalLogs} log</span>
          </div>
        </div>
      )}

      {isGuru && (
        <div className="guru-banner-logs">
          <span className="guru-icon">👨‍🏫</span>
          <div className="guru-info">
            <span className="guru-status">
              Status: <span>Guru</span>
            </span>
            <span>|</span>
            <span>👁️ Melihat semua log aktivitas</span>
            <span>|</span>
            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>📊 Total: {totalLogs} log</span>
          </div>
        </div>
      )}

      {isStaff && (
        <div className="staff-banner-logs">
          <span className="staff-icon">👨‍💼</span>
          <div className="staff-info">
            <span className="staff-status">
              Status: <span>Staff TU</span>
            </span>
            <span>|</span>
            <span>👁️ Melihat log aktivitas (sensitif disembunyikan)</span>
            <span>|</span>
            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>📊 Total: {totalLogs} log</span>
          </div>
        </div>
      )}

      {isSiswa && (
        <div className="siswa-banner-logs">
          <span className="siswa-icon">👨‍🎓</span>
          <div className="siswa-info">
            <span className="siswa-status">
              Status: <span>Siswa</span>
            </span>
            <span>|</span>
            <span>👁️ Melihat log aktivitas Anda sendiri</span>
            <span>|</span>
            <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>📊 Total: {totalLogs} log</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="logs-filters">
        <div className="filter-row">
          <div className="filter-group filter-group-action">
            <label htmlFor="actionFilter">🔍 Filter Aksi</label>
            <select
              id="actionFilter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="filter-select"
            >
              {getActionFilterOptions().map((opt) => (
                <option 
                  key={opt.value} 
                  value={opt.value}
                  disabled={opt.disabled}
                  style={opt.disabled ? { fontWeight: 'bold', color: '#888' } : {}}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group filter-group-search">
            <label htmlFor="searchLogs">🔎 Cari</label>
            <div className="search-input-wrapper">
              <input
                type="text"
                id="searchLogs"
                placeholder={isMobile ? "Cari..." : "Cari pengguna, aksi, detail..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-search"
              />
              {searchTerm && (
                <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group filter-group-date">
            <label htmlFor="startDate">📅 Dari</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="filter-date"
            />
          </div>
          
          <div className="filter-group filter-group-date">
            <label htmlFor="endDate">📅 Sampai</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="filter-date"
            />
          </div>
          
          <button className="btn-clear-filters" onClick={handleClearFilters} title="Reset semua filter">
            🔄 {isMobile ? 'Reset' : 'Reset Filter'}
          </button>
        </div>
      </div>

      {/* Table - Mobile Friendly */}
      <div className="logs-table-container">
        {isMobile ? (
          // Mobile Card View
          <div className="logs-mobile-cards">
            {currentLogs.length === 0 ? (
              <div className="logs-empty-mobile">
                <p>📭 Tidak ada log aktivitas yang ditemukan.</p>
              </div>
            ) : (
              currentLogs.map((log) => {
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';
                const roleDisplay = getRoleDisplayName(log.userRole || 'siswa');
                const roleIcon = getRoleIcon(log.userRole || 'siswa');
                const roleClass = getRoleBadgeClass(log.userRole || 'siswa');
                
                return (
                  <div key={log.id} className="log-card">
                    <div className="log-card-header">
                      <div className="log-card-user">
                        <strong>{escapeHtmlLog(log.userName || log.userId || 'unknown')}</strong>
                        <span className={`role-badge ${roleClass}`}>
                          {roleIcon} {roleDisplay}
                        </span>
                      </div>
                      <div className="log-card-time">{time}</div>
                    </div>
                    <div className="log-card-body">
                      <div className="log-card-action">
                        {getActionIcon(log.action)} {formatActionName(log.action)}
                      </div>
                      <div className="log-card-details">
                        {escapeHtmlLog(log.details || '-')}
                      </div>
                      {log.ipAddress && (
                        <div className="log-card-ip">
                          🌐 {log.ipAddress}
                        </div>
                      )}
                    </div>
                    {canDelete && (
                      <div className="log-card-actions">
                        <button
                          className="btn-delete-single"
                          onClick={() => handleDeleteSingle(log)}
                          title="Hapus log ini"
                          disabled={deleting}
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Desktop Table View
          <table className="logs-table">
            <thead>
              <tr>
                <th className="col-time">⏰ Waktu</th>
                <th className="col-user">👤 Pengguna</th>
                <th className="col-role">🎭 Role</th>
                <th className="col-action">📌 Aksi</th>
                <th className="col-details">📝 Detail</th>
                <th className="col-ip">🌐 IP</th>
                {canDelete && <th className="col-actions">⚙️</th>}
              </tr>
            </thead>
            <tbody>
              {currentLogs.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="logs-empty">
                    📭 Tidak ada log aktivitas yang ditemukan.
                  </td>
                </tr>
              ) : (
                currentLogs.map((log) => {
                  const time = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';
                  const roleDisplay = getRoleDisplayName(log.userRole || 'siswa');
                  const roleIcon = getRoleIcon(log.userRole || 'siswa');
                  const roleClass = getRoleBadgeClass(log.userRole || 'siswa');
                  
                  let rowClass = '';
                  if (log.action === 'delete_user' || log.action === 'reset_system' || log.action === 'delete_all_logs') {
                    rowClass = 'log-critical';
                  } else if (log.action === 'login' || log.action === 'logout') {
                    rowClass = 'log-auth';
                  } else if (log.action.includes('delete')) {
                    rowClass = 'log-delete';
                  }
                  
                  return (
                    <tr key={log.id} className={`log-row ${rowClass}`}>
                      <td className="col-time">{time}</td>
                      <td className="col-user">
                        <strong>{escapeHtmlLog(log.userName || log.userId || 'unknown')}</strong>
                      </td>
                      <td className="col-role">
                        <span className={`role-badge ${roleClass}`}>
                          {roleIcon} {roleDisplay}
                        </span>
                      </td>
                      <td className="col-action">
                        {getActionIcon(log.action)} {formatActionName(log.action)}
                      </td>
                      <td className="col-details">
                        {escapeHtmlLog(log.details || '-')}
                      </td>
                      <td className="col-ip">
                        <small>{log.ipAddress || '-'}</small>
                      </td>
                      {canDelete && (
                        <td className="col-actions">
                          <button
                            className="btn-delete-single"
                            onClick={() => handleDeleteSingle(log)}
                            title="Hapus log ini"
                            disabled={deleting}
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Footer */}
      <div className="logs-footer">
        <p className="footer-info">
          📌 Log aktivitas dari node <code className="footer-code">logs</code>
          <span className="footer-divider">•</span>
          {isSiswa ? '👨‍🎓 Log Anda sendiri' : 
           isGuru ? '👨‍🏫 Log semua pengguna' : 
           isStaff ? '👨‍💼 Log staff TU' : 
           isDeveloper ? '💻 Developer - Log lengkap' : 
           '📋 Log sistem'}
          <span className="footer-divider">•</span>
          <span className="footer-total">📊 {totalLogs} total log</span>
        </p>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
          🕐 Data real-time dari Firebase • {new Date().toLocaleString('id-ID')}
        </p>
      </div>

      {/* Delete Single Confirmation Modal */}
      {showDeleteConfirm && logToDelete && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className="modal-content modal-danger">
            <div className="modal-header">
              <h4>⚠️ Hapus Log</h4>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)} aria-label="Tutup">✕</button>
            </div>
            <div className="modal-body">
              <p>Apakah Anda yakin ingin menghapus log ini?</p>
              <div className="log-detail-preview">
                <div><strong>Waktu:</strong> {logToDelete.timestamp ? new Date(logToDelete.timestamp).toLocaleString('id-ID') : '-'}</div>
                <div><strong>Pengguna:</strong> {logToDelete.userName || logToDelete.userId || 'unknown'}</div>
                <div><strong>Aksi:</strong> {formatActionName(logToDelete.action)}</div>
                <div><strong>Detail:</strong> {logToDelete.details || '-'}</div>
              </div>
              <p className="warning-text">⚠️ Log akan dihapus PERMANEN dan tidak dapat dikembalikan!</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Batal
              </button>
              <button className="btn-confirm-delete" onClick={confirmDeleteSingle} disabled={deleting}>
                {deleting ? '⏳ Menghapus...' : '🗑️ Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {deleteAllConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteAllConfirm(false)}>
          <div className="modal-content modal-danger modal-large">
            <div className="modal-header">
              <h4>⚠️ Hapus Semua Log</h4>
              <button className="modal-close" onClick={() => setDeleteAllConfirm(false)} aria-label="Tutup">✕</button>
            </div>
            <div className="modal-body">
              <p>Apakah Anda yakin ingin menghapus <strong>SEMUA {totalLogs} log</strong> aktivitas?</p>
              <p className="warning-text">⚠️ TINDAKAN INI TIDAK DAPAT DIBATALKAN!</p>
              <p>Semua log akan dihapus permanen dari database.</p>
              <div className="delete-confirm-input">
                <label htmlFor="deleteAllConfirmInput">
                  Ketik <strong>"HAPUS SEMUA"</strong> untuk mengkonfirmasi:
                </label>
                <input
                  id="deleteAllConfirmInput"
                  type="text"
                  value={deleteAllText}
                  onChange={(e) => setDeleteAllText(e.target.value)}
                  placeholder="Ketik HAPUS SEMUA"
                  className="confirm-input"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setDeleteAllConfirm(false)} disabled={deleting}>
                Batal
              </button>
              <button
                className="btn-confirm-delete"
                onClick={confirmDeleteAll}
                disabled={deleting || deleteAllText !== 'HAPUS SEMUA'}
              >
                {deleting ? '⏳ Menghapus...' : '🔥 Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogAktivitas;