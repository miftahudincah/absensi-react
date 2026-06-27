// src/pages/AIAssistantPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, onValue, off, set, update, push } from 'firebase/database';
import { db } from '../firebase/config';
import './AiAssistantPage.css';

const AI_BACKEND_URL = 'https://backendtest-azure.vercel.app';

const AIAssistantPage = ({ user, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('groq');
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
  const [chatHistory, setChatHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [typingMessage, setTypingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isMounted = useRef(true);
  
  const AI_CACHE_TTL = 30000;

  // Quick Commands
  const quickCommands = [
    { label: '📋 Data Siswa', command: 'tampilkan data siswa' },
    { label: '📊 Rekap Absensi', command: 'rekap absensi hari ini' },
    { label: '🔍 Cari Siswa', command: 'cari siswa ' },
    { label: '👥 Data Staff', command: 'data staff' },
    { label: '📈 Statistik Kehadiran', command: 'statistik kehadiran' },
    { label: '💡 Bantuan', command: 'bantuan' },
  ];

  // ==================== CHECK MOBILE ====================
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ==================== HELPER FUNCTIONS ====================
  
  const getFormattedTime = () => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
  };

  // ==================== DATABASE HELPER FUNCTIONS ====================
  
  const refreshDataCache = useCallback(async () => {
    if (!user?.uid || !isMounted.current) return;
    
    const now = Date.now();
    if (now - dataCache.lastUpdate < AI_CACHE_TTL && dataCache.students.length > 0) {
      console.log("📊 Using cached AI data");
      return dataCache;
    }
    
    console.log("📊 Refreshing AI data cache from database...");
    
    try {
      const studentsSnapshot = await get(ref(db, 'users'));
      const studentsData = studentsSnapshot.val();
      const students = [];
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
      
      const attendanceSnapshot = await get(ref(db, 'absensi'));
      const attendanceData = attendanceSnapshot.val();
      const attendance = [];
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
      
      const staffSnapshot = await get(ref(db, 'staff'));
      const staffData = staffSnapshot.val();
      const staff = [];
      if (staffData) {
        Object.keys(staffData).forEach(key => {
          staff.push({ id: key, ...staffData[key] });
        });
      }
      
      const userAuthSnapshot = await get(ref(db, 'users_auth'));
      const userAuthData = userAuthSnapshot.val();
      const users_auth = [];
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
      }
      
      console.log(`✅ AI cache refreshed: ${students.length} students, ${attendance.length} attendance`);
      
    } catch (error) {
      console.error("Error refreshing AI data cache:", error);
    }
  }, [user?.uid, dataCache]);

  // ==================== FORMAT TABLE ====================
  
  const formatTableAI = (headers, rows) => {
    if (!rows || rows.length === 0) return 'Tidak ada data.';
    
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    rows.forEach(row => {
      table += '| ' + row.map(cell => cell || '-').join(' | ') + ' |\n';
    });
    
    return table;
  };

  // ==================== FORMAT MESSAGE ====================
  
  const formatMessage = (text) => {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(?!\*)(.*?)\*(?!\*)/g, '<em>$1</em>');
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
  };

  // ==================== AI COMMAND PROCESSOR ====================
  
  const processAICommand = useCallback(async (userMessage) => {
    const lowerMsg = userMessage.toLowerCase().trim();
    
    const isDataSiswa = lowerMsg.includes('data siswa') || lowerMsg.includes('siswa') || lowerMsg.includes('tampilkan siswa');
    const isCariSiswa = lowerMsg.includes('cari siswa') || lowerMsg.includes('cari') || lowerMsg.includes('id');
    const isRekap = lowerMsg.includes('rekap') || lowerMsg.includes('statistik') || lowerMsg.includes('ringkasan');
    const isStatistik = isRekap;
    const isKelas = lowerMsg.includes('kelas') && (lowerMsg.includes('x') || lowerMsg.includes('vii') || lowerMsg.includes('viii') || lowerMsg.includes('ix') || lowerMsg.includes('x') || lowerMsg.includes('xi') || lowerMsg.includes('xii'));
    const isJurusan = lowerMsg.includes('jurusan') || lowerMsg.includes('rpl') || lowerMsg.includes('tkj') || lowerMsg.includes('multimedia') || lowerMsg.includes('akuntansi');
    const isStaff = lowerMsg.includes('staff') || lowerMsg.includes('guru') || lowerMsg.includes('karyawan');
    const isHadir = lowerMsg.includes('hadir') || lowerMsg.includes('absensi') || lowerMsg.includes('kehadiran');
    const isBantuan = lowerMsg.includes('bantuan') || lowerMsg.includes('help') || lowerMsg.includes('tolong');
    const isPerSiswa = lowerMsg.includes('per siswa') || lowerMsg.includes('siswa id') || lowerMsg.includes('id ') || lowerMsg.match(/id\s*[0-9]+/);
    
    await refreshDataCache();
    
    // ============ PER SISWA ============
    if (isPerSiswa) {
      const idMatch = userMessage.match(/id\s*[:#]?\s*([0-9]+)/i);
      if (idMatch) {
        const studentId = idMatch[1];
        const student = dataCache.students.find(s => s.id == studentId);
        if (student) {
          const studentAttendance = dataCache.attendance.filter(a => a.studentId == studentId);
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
          
          const userAuth = dataCache.users_auth.find(u => u.fpId == studentId);
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
    
    // ============ DATA SISWA ============
    if (isDataSiswa || isCariSiswa) {
      let searchTerm = '';
      const nameMatch = userMessage.match(/siswa\s+([a-zA-Z\s]+)/i);
      if (nameMatch) {
        searchTerm = nameMatch[1].trim().toLowerCase();
      }
      
      let filteredStudents = dataCache.students;
      
      if (isKelas) {
        const kelasMatch = userMessage.match(/kelas\s*([a-z0-9\s]+)/i);
        if (kelasMatch) {
          const kelas = kelasMatch[1].trim().toUpperCase();
          filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
        }
      }
      
      if (isJurusan) {
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
    
    // ============ REKAP ============
    if (isRekap || isStatistik || isHadir) {
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = dataCache.attendance.filter(a => a.date === today);
      const hadirToday = todayAttendance.filter(a => a.status === 'Hadir').length;
      const pulangToday = todayAttendance.filter(a => a.status === 'Pulang').length;
      const totalSiswa = dataCache.students.length;
      const persenHadir = totalSiswa > 0 ? ((hadirToday / totalSiswa) * 100).toFixed(1) : 0;
      
      const kelasStats = {};
      dataCache.students.forEach(s => {
        const kelas = s.kelas || 'Tanpa Kelas';
        if (!kelasStats[kelas]) {
          kelasStats[kelas] = { total: 0, hadir: 0 };
        }
        kelasStats[kelas].total++;
      });
      todayAttendance.forEach(a => {
        const student = dataCache.students.find(s => s.id == a.studentId);
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
    
    // ============ DATA STAFF ============
    if (isStaff) {
      if (dataCache.staff.length === 0) {
        return '📭 Belum ada data staff.';
      }
      
      let response = `👥 **Data Staff (${dataCache.staff.length})**\n\n`;
      const headers = ['ID', 'Nama', 'Jabatan', 'Departemen'];
      const rows = dataCache.staff.map(s => [
        s.id,
        s.nama || '-',
        s.jabatan || '-',
        s.departemen || '-'
      ]);
      response += formatTableAI(headers, rows);
      return response;
    }
    
    // ============ BANTUAN ============
    if (isBantuan) {
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
  
  const callAIBackendAPI = async (userMessage, conversationHistory) => {
    const endpoint = selectedModel === 'groq' 
      ? `${AI_BACKEND_URL}/api/ai/groq`
      : `${AI_BACKEND_URL}/api/ai/openai`;
    
    const payload = {
      message: userMessage,
      history: conversationHistory
    };
    
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
  };

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
    if (isLoading) return;
    
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
        
        await saveChatHistory([...messages, userMessage, assistantMessage]);
        
        if (user?.uid) {
          const unreadRef = ref(db, `ai_assistance/${user.uid}/unread`);
          await set(unreadRef, { count: 0, lastRead: Date.now() });
          setUnreadCount(0);
        }
      } else {
        const historyForAI = messages.slice(0, -1).map(m => ({
          role: m.role,
          content: m.content
        }));
        
        const aiResponse = await callAIBackendAPI(rawMessage, historyForAI);
        const assistantMessage = { role: 'assistant', content: aiResponse, timestamp: Date.now() };
        setMessages(prev => [...prev, assistantMessage]);
        
        await saveChatHistory([...messages, userMessage, assistantMessage]);
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
  }, [inputMessage, isLoading, messages, processAICommand, user?.uid]);

  // ==================== SAVE CHAT HISTORY ====================
  
  const saveChatHistory = useCallback(async (chatMessages) => {
    if (!user?.uid) return;
    
    try {
      const historyRef = ref(db, `ai_assistance/${user.uid}/history`);
      const historySnapshot = await get(historyRef);
      const existingHistory = historySnapshot.val() || [];
      
      const allMessages = [...existingHistory, ...chatMessages];
      const trimmedHistory = allMessages.slice(-50);
      
      await set(historyRef, trimmedHistory);
      if (isMounted.current) {
        setChatHistory(trimmedHistory);
      }
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }, [user?.uid]);

  // ==================== LOAD CHAT HISTORY ====================
  
  const loadChatHistory = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const historyRef = ref(db, `ai_assistance/${user.uid}/history`);
      const historySnapshot = await get(historyRef);
      const history = historySnapshot.val() || [];
      if (isMounted.current) {
        setChatHistory(history);
        if (history.length > 0) {
          setMessages(history);
        } else {
          resetChatHistory();
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      if (isMounted.current) {
        resetChatHistory();
      }
    }
  }, [user?.uid]);

  // ==================== RESET CHAT ====================
  
  const resetChatHistory = useCallback(async () => {
    if (isLoading || !isMounted.current) return;
    
    const welcomeMessage = `Halo! Saya **Asisten AI Sistem Absensi IoT** 👋

Saya dapat membantu Anda dengan berbagai hal terkait sistem absensi:

✨ **Fitur yang saya kuasai:**
• 🔍 Mencari dan menampilkan data siswa
• 📊 Rekap absensi harian
• 📈 Statistik kehadiran per kelas
• 👥 Data staff dan kehadiran
• 💡 Panduan penggunaan sistem

📊 **Data Real-Time:**
• Data siswa: ${dataCache.students.length} siswa
• Absensi hari ini: ${dataCache.attendance.filter(a => a.date === new Date().toISOString().split('T')[0]).length} transaksi
• Staff: ${dataCache.staff.length} orang

💡 **Coba tanyakan:**
• "data siswa kelas X"
• "rekap absensi hari ini"
• "cari siswa miftah"
• "data staff"

Siap membantu Anda 24/7! 😊`;
    
    const welcomeMsg = { role: 'assistant', content: welcomeMessage, timestamp: Date.now() };
    if (isMounted.current) {
      setMessages([welcomeMsg]);
    }
    
    if (user?.uid && isMounted.current) {
      await set(ref(db, `ai_assistance/${user.uid}/history`), [welcomeMsg]);
      setChatHistory([welcomeMsg]);
    }
  }, [isLoading, dataCache, user?.uid]);

  // ==================== CLEAR CHAT HISTORY ====================
  
  const clearChatHistory = useCallback(async () => {
    if (!user?.uid || isLoading || !isMounted.current) return;
    
    if (window.confirm('Yakin ingin menghapus semua riwayat chat?')) {
      try {
        await set(ref(db, `ai_assistance/${user.uid}/history`), []);
        if (isMounted.current) {
          setChatHistory([]);
        }
        resetChatHistory();
      } catch (error) {
        console.error('Error clearing chat history:', error);
      }
    }
  }, [user?.uid, isLoading, resetChatHistory]);

  // ==================== SCROLL TO BOTTOM ====================
  
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    isMounted.current = true;
    
    if (user?.uid) {
      refreshDataCache();
      checkBackendStatus();
      loadChatHistory();
      setIsInitialized(true);
      
      const unreadRef = ref(db, `ai_assistance/${user.uid}/unread`);
      const unsubscribe = onValue(unreadRef, (snapshot) => {
        if (!isMounted.current) return;
        const data = snapshot.val();
        setUnreadCount(data?.count || 0);
      });
      
      return () => {
        isMounted.current = false;
        off(unreadRef);
        unsubscribe();
        if (typingTimeoutRef.current) {
          clearInterval(typingTimeoutRef.current);
        }
      };
    }
    
    return () => {
      isMounted.current = false;
      if (typingTimeoutRef.current) {
        clearInterval(typingTimeoutRef.current);
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isLoading && inputMessage.trim() !== '') {
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
  }, [inputMessage, isLoading, handleSendMessage]);

  // Typing effect
  useEffect(() => {
    if (isTyping) {
      const dots = ['', '.', '..', '...'];
      let i = 0;
      typingTimeoutRef.current = setInterval(() => {
        if (isMounted.current) {
          setTypingMessage(`Mengetik${dots[i % dots.length]}`);
          i++;
        }
      }, 500);
    } else {
      clearInterval(typingTimeoutRef.current);
      if (isMounted.current) {
        setTypingMessage('');
      }
    }
    
    return () => clearInterval(typingTimeoutRef.current);
  }, [isTyping]);

  // ==================== RENDER ====================

  return (
    <div className="ai-assistant-fullpage">
      {/* Header */}
      <div className="ai-page-header">
        <div className="ai-page-header-left">
          {/* Tombol Back */}
          {onBack && (
            <button className="ai-back-btn" onClick={onBack} title="Kembali">
              ←
            </button>
          )}
          <span className="ai-page-icon">🤖</span>
          <div>
            <h1 className="ai-page-title">AI Assistant</h1>
            <div className="ai-page-subtitle">
              <span className={`status-dot ${backendStatus ? 'online' : 'offline'}`}></span>
              {backendStatus ? '🟢 Online' : '🟡 Menghubungkan...'}
              <span className="ai-model-badge">
                {selectedModel === 'groq' ? '⚡ GROQ' : '✨ OpenAI'}
              </span>
            </div>
          </div>
        </div>
        <div className="ai-page-header-right">
          {!isMobile && (
            <>
              <button 
                className="ai-page-btn"
                onClick={() => setShowQuickCommands(!showQuickCommands)}
                title="Perintah Cepat"
              >
                ⚡
              </button>
              <button 
                className="ai-page-btn"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                title="Riwayat Chat"
              >
                📜
              </button>
              <button 
                className="ai-page-btn"
                onClick={clearChatHistory}
                title="Hapus Riwayat"
                disabled={isLoading}
              >
                🗑️
              </button>
              <button 
                className="ai-page-btn"
                onClick={resetChatHistory}
                title="Reset Chat"
                disabled={isLoading}
              >
                🔄
              </button>
            </>
          )}
          <select 
            className="ai-page-model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
          >
            <option value="groq">GROQ</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      {/* Quick Commands */}
      {showQuickCommands && (
        <div className="ai-quick-commands">
          {quickCommands.map((cmd, index) => (
            <button
              key={index}
              className="ai-quick-command-btn"
              onClick={() => {
                setInputMessage(cmd.command);
                setShowQuickCommands(false);
                inputRef.current?.focus();
              }}
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <div className="ai-page-chat-container">
        <div className="ai-chat-messages" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="ai-empty-state">
              <div className="ai-empty-icon">🤖</div>
              <h3>Mulai Percakapan</h3>
              <p>Tanyakan tentang data siswa, absensi, atau bantuan sistem</p>
              <div className="ai-empty-commands">
                <button onClick={() => setInputMessage('data siswa')}>📋 Data Siswa</button>
                <button onClick={() => setInputMessage('rekap absensi hari ini')}>📊 Rekap Absensi</button>
                <button onClick={() => setInputMessage('bantuan')}>💡 Bantuan</button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={`msg-${index}`} 
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
            <div className="ai-message assistant">
              <div className="ai-avatar">🤖</div>
              <div className="ai-message-content">
                <div className="ai-bubble typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span className="typing-text">{typingMessage}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="ai-page-input-area">
          <div className="ai-input-wrapper">
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder="Tanyakan sesuatu... (Enter untuk kirim)"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              rows={isMobile ? 1 : 2}
              disabled={isLoading}
            />
            <button
              className="ai-send-btn"
              onClick={handleSendMessage}
              disabled={isLoading || inputMessage.trim() === ''}
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
          <div className="ai-input-footer">
            <div className="ai-footer-left">
              <span className="ai-status">
                {backendStatus ? '🟢' : '🟡'} {backendStatus ? 'Online' : 'Menghubungkan...'}
              </span>
              <span className="ai-data-info">
                📊 {dataCache.students.length} siswa
              </span>
            </div>
            <div className="ai-footer-right">
              <span className="ai-char-count">{inputMessage.length} karakter</span>
              {!isMobile && <span className="ai-enter-hint">↵ Enter kirim</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Chat History Sidebar */}
      {isHistoryOpen && (
        <div className="ai-history-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="ai-history-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="ai-history-header">
              <h3>📜 Riwayat Chat</h3>
              <button className="ai-history-close" onClick={() => setIsHistoryOpen(false)}>✖</button>
            </div>
            <div className="ai-history-list">
              {chatHistory.length === 0 ? (
                <div className="ai-history-empty">Belum ada riwayat chat</div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={`history-${index}`} className={`ai-history-item ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                    <span className="ai-history-role">{msg.role === 'user' ? '👤' : '🤖'}</span>
                    <span className="ai-history-preview">
                      {msg.content.substring(0, 50)}{msg.content.length > 50 ? '...' : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Actions */}
      {isMobile && (
        <div className="ai-mobile-actions">
          <button 
            className="ai-mobile-action-btn"
            onClick={() => setShowQuickCommands(!showQuickCommands)}
          >
            ⚡
          </button>
          <button 
            className="ai-mobile-action-btn"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          >
            📜
          </button>
          <button 
            className="ai-mobile-action-btn"
            onClick={clearChatHistory}
            disabled={isLoading}
          >
            🗑️
          </button>
          <button 
            className="ai-mobile-action-btn"
            onClick={resetChatHistory}
            disabled={isLoading}
          >
            🔄
          </button>
        </div>
      )}
    </div>
  );
};

export default AIAssistantPage;