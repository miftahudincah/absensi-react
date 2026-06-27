// src/components/AiAssistant.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, get, onValue, off, set } from 'firebase/database';
import { db } from '../firebase/config';
import './AiAssistant.css';

const AI_BACKEND_URL = 'https://backendtest-azure.vercel.app';

// ==================== KONFIGURASI ====================
const AI_CACHE_TTL = 30000;
const DEBOUNCE_DELAY = 300;
const MAX_RETRY = 3;

const AiAssistant = ({ user }) => {
  // ==================== STATE ====================
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('groq');
  const [isOpen, setIsOpen] = useState(false);
  const [dataCache, setDataCache] = useState({
    students: [],
    attendance: [],
    staff: [],
    users_auth: [],
    lastUpdate: 0
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // ==================== REFS ====================
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isMounted = useRef(true);
  const scrollTimeout = useRef(null);
  const debounceTimer = useRef(null);
  const refreshLock = useRef(false);
  const lastScrollTime = useRef(0);
  const headerRef = useRef(null);

  // ==================== CHECK MOBILE ====================
  useEffect(() => {
    const checkMobile = () => {
      if (isMounted.current) {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      isMounted.current = false;
    };
  }, []);

  // ==================== HELPER FUNCTIONS ====================
  
  const getFormattedTime = useCallback(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const escapeHtml = useCallback((text) => {
    if (!text) return '';
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
  }, []);

  // ==================== DATABASE HELPER FUNCTIONS ====================
  
  const refreshDataCache = useCallback(async (force = false) => {
    if (!user?.uid || !isMounted.current) return;
    
    if (refreshLock.current) {
      console.log("⏳ Refresh already in progress, skipping...");
      return;
    }
    
    const now = Date.now();
    const cacheAge = now - dataCache.lastUpdate;
    const isCacheValid = cacheAge < AI_CACHE_TTL && dataCache.students.length > 0;
    
    if (!force && isCacheValid) {
      console.log(`📊 Using cached AI data (age: ${(cacheAge/1000).toFixed(1)}s)`);
      return;
    }
    
    refreshLock.current = true;
    setIsRefreshing(true);
    console.log("📊 Refreshing AI data cache from database...");
    
    try {
      const [studentsSnapshot, attendanceSnapshot, staffSnapshot, userAuthSnapshot] = await Promise.all([
        get(ref(db, 'users')),
        get(ref(db, 'absensi')),
        get(ref(db, 'staff')),
        get(ref(db, 'users_auth'))
      ]);
      
      const students = [];
      const studentsData = studentsSnapshot.val();
      if (studentsData) {
        Object.keys(studentsData).forEach(key => {
          students.push({ id: key, ...studentsData[key] });
        });
      }
      
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const attendance = [];
      const attendanceData = attendanceSnapshot.val();
      if (attendanceData) {
        Object.keys(attendanceData).forEach(date => {
          if (date >= startDate && date <= endDate) {
            const dailyRecords = attendanceData[date];
            if (dailyRecords) {
              Object.keys(dailyRecords).forEach(id => {
                const record = dailyRecords[id];
                if (record) {
                  attendance.push({
                    id: date + "-" + id,
                    studentId: id,
                    date: date,
                    timeIn: record.in,
                    timeOut: record.out,
                    nama: record.nama,
                    kelas: record.kelas,
                    jurusan: record.jurusan,
                    status: record.out ? "Pulang" : "Hadir"
                  });
                }
              });
            }
          }
        });
      }
      
      const staff = [];
      const staffData = staffSnapshot.val();
      if (staffData) {
        Object.keys(staffData).forEach(key => {
          staff.push({ id: key, ...staffData[key] });
        });
      }
      
      const users_auth = [];
      const userAuthData = userAuthSnapshot.val();
      if (userAuthData) {
        Object.keys(userAuthData).forEach(key => {
          users_auth.push({ uid: key, ...userAuthData[key] });
        });
      }
      
      if (isMounted.current) {
        setDataCache({
          students,
          attendance,
          staff,
          users_auth,
          lastUpdate: Date.now()
        });
        console.log(`✅ AI cache refreshed: ${students.length} students, ${attendance.length} attendance, ${staff.length} staff`);
      }
      
    } catch (error) {
      console.error("Error refreshing AI data cache:", error);
    } finally {
      refreshLock.current = false;
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [user?.uid, dataCache.lastUpdate, dataCache.students.length]);

  // ==================== FORMAT TABLE ====================
  
  const formatTableAI = useCallback((headers, rows) => {
    if (!rows || rows.length === 0) return 'Tidak ada data.';
    
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    rows.forEach(row => {
      table += '| ' + row.map(cell => cell || '-').join(' | ') + ' |\n';
    });
    
    return table;
  }, []);

  // ==================== FORMAT MESSAGE ====================
  
  const formatMessage = useCallback((text) => {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(?!\*)(.*?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    
    const lines = html.split('<br>');
    let inTable = false;
    let tableRows = [];
    let tableHeaders = [];
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').filter(c => c.trim() !== '');
        const cleanCells = cells.map(c => c.trim());
        
        if (cleanCells.every(c => /^---*$/.test(c))) {
          continue;
        }
        
        if (!inTable) {
          inTable = true;
          tableHeaders = cleanCells;
          tableRows = [];
        } else {
          tableRows.push(cleanCells);
        }
      } else {
        if (inTable) {
          let tableHtml = `<table class="ai-table">`;
          tableHtml += `<thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
          tableHtml += `<tbody>`;
          tableRows.forEach(row => {
            tableHtml += `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`;
          });
          tableHtml += `</tbody></table>`;
          result.push(tableHtml);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        
        if (line) {
          result.push(line);
        }
      }
    }
    
    if (inTable) {
      let tableHtml = `<table class="ai-table">`;
      tableHtml += `<thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      tableHtml += `<tbody>`;
      tableRows.forEach(row => {
        tableHtml += `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`;
      });
      tableHtml += `</tbody></table>`;
      result.push(tableHtml);
    }
    
    return result.join('<br>');
  }, [escapeHtml]);

  // ==================== AI COMMAND PROCESSOR ====================
  
  const processAICommand = useCallback(async (userMessage) => {
    const lowerMsg = userMessage.toLowerCase().trim();
    
    const patterns = {
      isDataSiswa: /data siswa|siswa|tampilkan siswa/i,
      isCariSiswa: /cari siswa|cari|id/i,
      isRekap: /rekap|statistik|ringkasan/i,
      isKelas: /kelas\s*(x|v?i{1,3}|[0-9]+)/i,
      isJurusan: /jurusan|rpl|tkj|multimedia|akuntansi/i,
      isStaff: /staff|guru|karyawan/i,
      isHadir: /hadir|absensi|kehadiran/i,
      isBantuan: /bantuan|help|tolong/i,
      isPerSiswa: /per siswa|siswa id|id\s*[:#]?\s*[0-9]+/i
    };
    
    const matchedPatterns = Object.entries(patterns).filter(([key, pattern]) => 
      pattern.test(lowerMsg)
    );
    
    if (matchedPatterns.length === 0) return null;
    
    await refreshDataCache(false);
    
    const { students, attendance, staff, users_auth } = dataCache;
    
    // PerSiswa
    if (patterns.isPerSiswa.test(lowerMsg)) {
      const idMatch = userMessage.match(/id\s*[:#]?\s*([0-9]+)/i);
      if (idMatch) {
        const studentId = idMatch[1];
        const student = students.find(s => s.id == studentId);
        if (student) {
          const studentAttendance = attendance.filter(a => a.studentId == studentId);
          const hadir = studentAttendance.filter(a => a.status === 'Hadir').length;
          const pulang = studentAttendance.filter(a => a.status === 'Pulang').length;
          const total = studentAttendance.length;
          
          let response = `📋 **Data Siswa ID #${student.id}**\n\n`;
          response += `👤 **Nama:** ${student.nama}\n`;
          response += `📚 **Kelas:** ${student.kelas || '-'}\n`;
          response += `🎓 **Jurusan:** ${student.jurusan || '-'}\n`;
          response += `⏰ **Delay Pulang:** ${student.delayOut || 60} menit\n\n`;
          response += `📊 **Statistik Absensi:**\n`;
          response += `• ✅ Hadir: ${hadir} kali\n`;
          response += `• 🏠 Pulang: ${pulang} kali\n`;
          response += `• 📝 Total: ${total} transaksi\n`;
          
          const userAuth = users_auth.find(u => u.fpId == studentId);
          if (userAuth) {
            response += `\n🔐 **Akun:** ${userAuth.email || '-'} (${userAuth.role || '-'})`;
          } else {
            response += `\n🔐 **Akun:** ❌ Belum terdaftar`;
          }
          
          return response;
        } else {
          return `❌ Siswa dengan ID #${studentId} tidak ditemukan.`;
        }
      }
    }
    
    // Data Siswa
    if (patterns.isDataSiswa.test(lowerMsg) || patterns.isCariSiswa.test(lowerMsg)) {
      let searchTerm = '';
      const nameMatch = userMessage.match(/siswa\s+([a-zA-Z\s]+)/i);
      if (nameMatch) {
        searchTerm = nameMatch[1].trim().toLowerCase();
      }
      
      let filteredStudents = students;
      
      if (patterns.isKelas.test(lowerMsg)) {
        const kelasMatch = userMessage.match(/kelas\s*([a-z0-9\s]+)/i);
        if (kelasMatch) {
          const kelas = kelasMatch[1].trim().toUpperCase();
          filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
        }
      }
      
      if (patterns.isJurusan.test(lowerMsg)) {
        const jurusanMatch = userMessage.match(/jurusan\s*([a-z0-9\s]+)/i);
        if (jurusanMatch) {
          const jurusan = jurusanMatch[1].trim().toUpperCase();
          filteredStudents = filteredStudents.filter(s => s.jurusan === jurusan);
        }
      }
      
      if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
          s.nama && s.nama.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filteredStudents.length === 0) {
        return '📭 Tidak ada siswa yang ditemukan dengan kriteria tersebut.';
      }
      
      if (filteredStudents.length > 50) {
        return `📊 Terdapat **${filteredStudents.length}** siswa. Untuk detail, gunakan filter spesifik seperti "siswa kelas X" atau "siswa jurusan RPL".`;
      }
      
      let response = `📋 **Data Siswa (${filteredStudents.length} ditemukan)**\n\n`;
      const headers = ['ID', 'Nama', 'Kelas', 'Jurusan', 'Delay'];
      const rows = filteredStudents.map(s => [
        s.id,
        s.nama || '-',
        s.kelas || '-',
        s.jurusan || '-',
        `${s.delayOut || 60} menit`
      ]);
      response += formatTableAI(headers, rows);
      return response;
    }
    
    // Rekap
    if (patterns.isRekap.test(lowerMsg) || patterns.isHadir.test(lowerMsg)) {
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = attendance.filter(a => a.date === today);
      const hadirToday = todayAttendance.filter(a => a.status === 'Hadir').length;
      const pulangToday = todayAttendance.filter(a => a.status === 'Pulang').length;
      const totalSiswa = students.length;
      const persenHadir = totalSiswa > 0 ? ((hadirToday / totalSiswa) * 100).toFixed(1) : 0;
      
      const kelasStats = {};
      students.forEach(s => {
        const kelas = s.kelas || 'Tanpa Kelas';
        if (!kelasStats[kelas]) {
          kelasStats[kelas] = { total: 0, hadir: 0 };
        }
        kelasStats[kelas].total++;
      });
      todayAttendance.forEach(a => {
        const student = students.find(s => s.id == a.studentId);
        if (student && student.kelas) {
          if (kelasStats[student.kelas]) {
            kelasStats[student.kelas].hadir++;
          }
        }
      });
      
      let response = `📊 **REKAP ABSENSI**\n\n`;
      response += `📅 **Tanggal:** ${today}\n`;
      response += `👥 **Total Siswa:** ${totalSiswa}\n`;
      response += `✅ **Hadir Hari Ini:** ${hadirToday} (${persenHadir}%)\n`;
      response += `🏠 **Pulang:** ${pulangToday}\n`;
      response += `📝 **Total Transaksi:** ${todayAttendance.length}\n\n`;
      
      response += `🏫 **Kehadiran per Kelas:**\n`;
      const kelasEntries = Object.entries(kelasStats);
      if (kelasEntries.length > 0) {
        const kelasRows = kelasEntries.map(([kelas, stats]) => [
          kelas,
          stats.total,
          stats.hadir,
          stats.total > 0 ? ((stats.hadir / stats.total) * 100).toFixed(1) + '%' : '0%'
        ]);
        response += formatTableAI(['Kelas', 'Total', 'Hadir', 'Persentase'], kelasRows);
      } else {
        response += 'Belum ada data kelas.\n';
      }
      
      return response;
    }
    
    // Staff
    if (patterns.isStaff.test(lowerMsg)) {
      if (staff.length === 0) {
        return '📭 Belum ada data staff.';
      }
      
      let response = `👥 **Data Staff (${staff.length})**\n\n`;
      const headers = ['ID', 'Nama', 'Jabatan', 'Departemen'];
      const rows = staff.map(s => [
        s.id,
        s.nama || '-',
        s.jabatan || '-',
        s.departemen || '-'
      ]);
      response += formatTableAI(headers, rows);
      return response;
    }
    
    // Bantuan
    if (patterns.isBantuan.test(lowerMsg)) {
      return `🤖 **Perintah yang Didukung AI Assistant:**

📋 **Data Siswa:**
• "data siswa" - Lihat semua siswa
• "siswa kelas X" - Filter berdasarkan kelas
• "siswa jurusan RPL" - Filter berdasarkan jurusan
• "cari siswa [nama]" - Cari siswa by nama
• "id 5" - Detail siswa berdasarkan ID

📊 **Rekap & Statistik:**
• "rekap" - Ringkasan absensi hari ini
• "statistik" - Statistik kehadiran per kelas
• "kehadiran" - Status kehadiran hari ini

👥 **Data Staff:**
• "data staff" - Lihat semua staff

💡 **Bantuan Lain:**
• "bantuan" atau "help" - Tampilkan ini

🔍 **Contoh:**
• "data siswa kelas X"
• "siswa jurusan RPL"
• "id 5"
• "rekap hari ini"
• "cari siswa miftah"
• "data staff"

---
📱 *Saya dapat membantu Anda dengan data sistem absensi secara real-time!*`;
    }
    
    return null;
  }, [dataCache, refreshDataCache, formatTableAI]);

  // ==================== CALL AI BACKEND ====================
  
  const callAIBackendAPI = useCallback(async (userMessage, conversationHistory, retryCount = 0) => {
    const endpoint = selectedModel === 'groq' 
      ? `${AI_BACKEND_URL}/api/ai/groq`
      : `${AI_BACKEND_URL}/api/ai/openai`;
    
    const payload = {
      message: userMessage,
      history: conversationHistory
    };
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal mendapatkan respons dari AI');
      }
      
      if (!data.response) throw new Error('Tidak ada balasan dari AI');
      
      return data.response;
    } catch (error) {
      if (retryCount < MAX_RETRY) {
        console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRY}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callAIBackendAPI(userMessage, conversationHistory, retryCount + 1);
      }
      throw error;
    }
  }, [selectedModel]);

  // ==================== CHECK BACKEND STATUS ====================
  
  const checkBackendStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${AI_BACKEND_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok && isMounted.current) {
        const health = await response.json();
        console.log('✅ Backend Status:', health.services);
        setBackendStatus(health);
      } else if (isMounted.current) {
        setBackendStatus(null);
      }
    } catch (error) {
      console.warn('⚠️ Tidak dapat menjangkau backend:', error.message);
      if (isMounted.current) {
        setBackendStatus(null);
      }
    }
  }, []);

  // ==================== SEND MESSAGE ====================
  
  const handleSendMessage = useCallback(async () => {
    if (isLoading || isTyping) return;
    
    const rawMessage = inputMessage.trim();
    if (rawMessage === '') return;
    
    setInputMessage('');
    const userMessage = { role: 'user', content: rawMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    setIsTyping(true);
    
    try {
      const dbResponse = await processAICommand(rawMessage);
      
      if (dbResponse) {
        const assistantMessage = { role: 'assistant', content: dbResponse, timestamp: Date.now() };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (user?.uid) {
          const unreadRef = ref(db, `ai_assistance/${user.uid}/unread`);
          await set(unreadRef, { count: 0, lastRead: Date.now() });
          setUnreadCount(0);
        }
      } else {
        const historyForAI = messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }));
        
        const aiResponse = await callAIBackendAPI(rawMessage, historyForAI);
        const assistantMessage = { role: 'assistant', content: aiResponse, timestamp: Date.now() };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      
      let errorMessage = `⚠️ Gagal: ${error.message}`;
      if (error.message && error.message.includes('GROQ_API_KEY')) {
        errorMessage = `🚫 **GROQ API Key Belum Dikonfigurasi**\n\nAdmin harus menambahkan GROQ_API_KEY di environment variables Vercel.`;
      } else if (error.message && error.message.includes('fetch')) {
        errorMessage = `⚠️ **Koneksi ke Backend Gagal**\n\nPastikan backend berjalan dan terhubung ke internet.\n\n💡 Backend URL: ${AI_BACKEND_URL}`;
      }
      
      const assistantMessage = { role: 'assistant', content: errorMessage, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [inputMessage, isLoading, isTyping, processAICommand, callAIBackendAPI, messages, user]);

  // ==================== RESET CHAT ====================
  
  const resetChatHistory = useCallback(() => {
    if (isLoading || isTyping) return;
    
    const welcomeMessage = `Halo! Saya **Asisten AI Sistem Absensi IoT** 👋

Saya dapat membantu Anda dengan berbagai hal terkait sistem absensi:

✨ **Fitur yang saya kuasai:**
• 🔍 Mencari dan menampilkan data siswa
• 📊 Rekap absensi harian/mingguan/bulanan
• 📈 Statistik kehadiran dalam bentuk grafik
• 🔐 Informasi reset password (Email + WhatsApp)
• 📱 Panduan penggunaan sistem
• 👥 Data staff dan kehadiran

💡 **Contoh pertanyaan:**
• "tampilkan data siswa kelas X"
• "rekap absensi hari ini"
• "statistik kehadiran minggu ini"
• "cara reset password"
• "bantuan absensi"
• "id 5" (detail siswa)

📊 **Data Real-Time:**
• Data siswa: ${dataCache.students.length} siswa
• Absensi hari ini: ${dataCache.attendance.filter(a => a.date === new Date().toISOString().split('T')[0]).length} transaksi
• Staff: ${dataCache.staff.length} orang

Siap membantu Anda 24/7! Silakan tanyakan apa saja 😊`;
    
    setMessages([
      { role: 'assistant', content: welcomeMessage, timestamp: Date.now() }
    ]);
  }, [isLoading, isTyping, dataCache]);

  // ==================== SCROLL TO BOTTOM ====================
  
  const scrollToBottom = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollTime.current < 50) return;
    lastScrollTime.current = now;
    
    if (scrollTimeout.current) {
      cancelAnimationFrame(scrollTimeout.current);
    }
    
    scrollTimeout.current = requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }, []);

  // ==================== DRAG FUNCTIONS ====================
  
  const handleDragStart = useCallback((e) => {
    if (!isMobile) {
      const touch = e.touches ? e.touches[0] : e;
      const rect = e.currentTarget.getBoundingClientRect();
      setIsDragging(true);
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      });
    }
  }, [isMobile]);

  const handleDragMove = useCallback((e) => {
    if (isDragging && !isMobile) {
      const touch = e.touches ? e.touches[0] : e;
      const container = document.querySelector('.ai-assistant-container');
      if (container) {
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        const newX = Math.max(0, Math.min(touch.clientX - dragOffset.x, maxX));
        const newY = Math.max(0, Math.min(touch.clientY - dragOffset.y, maxY));
        setPosition({ x: newX, y: newY });
        container.style.left = newX + 'px';
        container.style.top = newY + 'px';
        container.style.transform = 'none';
      }
    }
  }, [isDragging, dragOffset, isMobile]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (user?.uid && !isInitialized) {
      const init = async () => {
        await refreshDataCache(true);
        checkBackendStatus();
        resetChatHistory();
        setIsInitialized(true);
      };
      init();
    }
  }, [user?.uid, isInitialized, refreshDataCache, checkBackendStatus, resetChatHistory]);
  
  useEffect(() => {
    if (!user?.uid) return;
    
    const unreadRef = ref(db, `ai_assistance/${user.uid}/unread`);
    const unsubscribe = onValue(unreadRef, (snapshot) => {
      if (isMounted.current) {
        const data = snapshot.val();
        setUnreadCount(data?.count || 0);
      }
    });
    
    return () => {
      off(unreadRef);
      unsubscribe();
    };
  }, [user?.uid]);
  
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isTyping && inputMessage.trim() !== '') {
        e.preventDefault();
        handleSendMessage();
      }
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
      return () => {
        input.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [inputMessage, isLoading, isTyping, handleSendMessage]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (scrollTimeout.current) {
        cancelAnimationFrame(scrollTimeout.current);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // ==================== RENDER ====================
  
  if (!isOpen) {
    return (
      <button 
        className="ai-assistant-toggle"
        onClick={() => setIsOpen(true)}
        title="Buka AI Assistant"
        aria-label="Buka AI Assistant"
      >
        <span className="toggle-icon">🤖</span>
        {unreadCount > 0 && (
          <span className="toggle-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
        <span className="toggle-pulse"></span>
      </button>
    );
  }

  return (
    <div 
      className={`ai-assistant-container ${isMobile ? 'mobile' : ''} ${isMinimized ? 'minimized' : ''}`}
      style={isMobile ? {} : { left: position.x + 'px', top: position.y + 'px' }}
      role="dialog"
      aria-label="AI Assistant"
    >
      {/* Header */}
      <div 
        className="ai-assistant-header"
        ref={headerRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{ cursor: isMobile ? 'default' : 'grab' }}
      >
        <div className="header-left">
          <span className="header-icon">🤖</span>
          <div>
            <h3>AI Assistant</h3>
            <div className="header-status">
              <span className={`status-dot ${backendStatus ? 'online' : 'offline'}`}></span>
              <span className="header-subtitle">
                {backendStatus ? 'Online' : 'Menghubungkan...'}
              </span>
              <span className="header-model">
                {selectedModel === 'groq' ? '⚡ GROQ' : '✨ OpenAI'}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="header-btn minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximalkan' : 'Minimalkan'}
            aria-label={isMinimized ? 'Maximalkan' : 'Minimalkan'}
          >
            {isMinimized ? '⤢' : '⤥'}
          </button>
          <button 
            className="header-btn reset-btn"
            onClick={resetChatHistory}
            title="Reset Chat"
            disabled={isLoading || isTyping}
            aria-label="Reset Chat"
          >
            🔄
          </button>
          <button 
            className="header-btn close-btn"
            onClick={() => setIsOpen(false)}
            title="Tutup AI Assistant"
            aria-label="Tutup AI Assistant"
          >
            ✖
          </button>
        </div>
      </div>

      {/* Model Selector */}
      <div className="ai-model-selector">
        <select 
          className="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isLoading || isTyping}
        >
          <option value="groq">⚡ GROQ (Llama 3.3 70B)</option>
          <option value="openai">✨ OpenAI (GPT-4o-mini)</option>
        </select>
        <button 
          className="refresh-btn"
          onClick={() => refreshDataCache(true)}
          disabled={isRefreshing}
          title="Refresh Data"
          aria-label="Refresh Data"
        >
          {isRefreshing ? '⏳' : '🔄'}
        </button>
        <span className="data-info">
          📊 {dataCache.students.length} siswa
        </span>
      </div>
      
      {/* Chat Messages */}
      <div className="ai-chat-messages" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">🤖</div>
            <h3>Mulai Percakapan</h3>
            <p>Tanyakan tentang data siswa, absensi, atau bantuan sistem</p>
            <div className="ai-example-commands">
              <button onClick={() => setInputMessage('data siswa')}>📋 Data Siswa</button>
              <button onClick={() => setInputMessage('rekap absensi hari ini')}>📊 Rekap</button>
              <button onClick={() => setInputMessage('bantuan')}>💡 Bantuan</button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={`msg-${index}-${msg.role}`} 
              className={`ai-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="ai-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="ai-message-content">
                <div className="ai-message-time">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : getFormattedTime()}
                </div>
                <div 
                  className="ai-bubble"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="ai-message assistant" key="typing-indicator">
            <div className="ai-avatar">🤖</div>
            <div className="ai-message-content">
              <div className="ai-message-time">{getFormattedTime()}</div>
              <div className="ai-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
                <span className="typing-text">Mengetik...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="ai-input-area">
        <div className="ai-input-wrapper">
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder="Tanyakan sesuatu... (Enter untuk kirim)"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            rows={isMobile ? 2 : 1}
            disabled={isLoading || isTyping}
            aria-label="Pesan AI"
          />
          <button
            className="ai-send-btn"
            onClick={handleSendMessage}
            disabled={isLoading || isTyping || inputMessage.trim() === ''}
            aria-label="Kirim pesan"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        <div className="ai-input-footer">
          <div className="footer-left">
            <span className="ai-status">
              {backendStatus ? '🟢 Online' : '🟡 Menghubungkan...'}
            </span>
            <span className="ai-data-info">
              {isRefreshing ? '🔄 Memuat data...' : `${dataCache.students.length} siswa • ${dataCache.staff.length} staff`}
            </span>
          </div>
          <div className="footer-right">
            <span className="ai-char-count">{inputMessage.length} karakter</span>
            {!isMobile && <span className="ai-enter-hint">↵ Enter kirim</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== EXPORT ====================
export default React.memo(AiAssistant);