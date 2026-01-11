import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, BarChart2, DollarSign, Users, 
  Save, Download, Trash2, FileText, ShieldAlert, 
  Mail, Clock, CheckCircle, Edit, X, Lock, LogOut, UserPlus, Key, Eye, EyeOff, RefreshCw,
  ChevronLeft, ChevronRight, PieChart as PieIcon, AlertCircle, Settings
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// --- Error Boundary (錯誤攔截元件) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-2xl w-full border border-red-200">
            <h1 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <AlertCircle className="w-8 h-8"/> 系統發生錯誤 (System Error)
            </h1>
            <p className="text-gray-700 mb-4">很抱歉，應用程式在執行時發生了意外錯誤。請將以下錯誤訊息提供給開發人員：</p>
            <div className="bg-gray-900 text-red-300 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed mb-4">
              {this.state.error && this.state.error.toString()}
              <br/>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Firebase Configuration & Initialization ---
let db, auth, currentAppId;
let firebaseInitialized = false;
let initError = null;

try {
  let firebaseConfig;
  
  // 1. 偵測環境
  if (typeof __firebase_config !== 'undefined') {
    // Canvas 預覽環境
    firebaseConfig = JSON.parse(__firebase_config);
    currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  } else {
    // 2. Vercel 正式環境 (請在此填入您的設定)
    firebaseConfig = {
      apiKey: "請填入您的API_KEY", // <--- 請確保這裡已替換為真實 Key
      authDomain: "請填入您的專案ID.firebaseapp.com",
      projectId: "請填入您的專案ID",
      storageBucket: "請填入您的專案ID.firebasestorage.app",
      messagingSenderId: "請填入您的SENDER_ID",
      appId: "請填入您的APP_ID"
    };
    currentAppId = 'company-pms-v1'; 
  }
  
  // 檢查是否已填寫設定 (若 apiKey 仍為預設文字，視為未設定)
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.includes("請填入")) {
    throw new Error("Firebase 設定尚未填寫 (請修改 src/App.jsx)");
  }

  // 初始化 Firebase
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  firebaseInitialized = true;

} catch (e) {
  console.error("Firebase Init Error:", e);
  initError = e.message;
}

// --- Constants ---
const INITIAL_ENGINEERS = ['Ryder', 'Sian', 'Peggy', 'Ken', 'Jc', 'JB'];
const PROJECT_YEARS = ['114', '115', '116', '117', '118'];
const PROJECT_STATUSES = ['進行中', '保固中', '過保固'];
const BANKS = ['兆豐銀行', '臺灣銀行'];
const ITEMS_PER_PAGE = 10;

const SUPER_ADMIN = {
  username: 'triotechno',
  email: 'admin@triotechno.com',
  role: 'admin',
  isFirstLogin: false 
};
const DEFAULT_ADMIN_PASS = 'tri57666';

const ENGINEER_COLORS = {
  'Ryder': 'bg-red-100 text-red-800 border-red-200',
  'Sian': 'bg-orange-100 text-orange-800 border-orange-200',
  'Peggy': 'bg-amber-100 text-amber-800 border-amber-200',
  'Ken': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Jc': 'bg-lime-100 text-lime-800 border-lime-200',
  'JB': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Other': 'bg-stone-100 text-stone-800 border-stone-200'
};

const getEngineerColor = (name) => ENGINEER_COLORS[name] || ENGINEER_COLORS['Other'];

const TYPE_COLORS = {
  '新專案': 'text-rose-600 bg-rose-50 border-rose-200',
  '擴充專案': 'text-indigo-600 bg-indigo-50 border-indigo-200',
  '維護案': 'text-teal-600 bg-teal-50 border-teal-200'
};

// --- Helper Functions ---
const generateRandomPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const validateWeakPassword = (password) => {
  const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  return regex.test(password);
};

const Captcha = ({ onVerify }) => {
  const canvasRef = useRef(null);
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');

  const drawCaptcha = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let newCode = '';
    for (let i = 0; i < 4; i++) newCode += chars[Math.floor(Math.random() * chars.length)];
    setCode(newCode);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 100, 40);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 100, 40);
      ctx.font = '24px Arial';
      ctx.fillStyle = '#333';
      ctx.textBaseline = 'middle';
      for(let i=0; i<5; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(Math.random()*100, Math.random()*40);
        ctx.lineTo(Math.random()*100, Math.random()*40);
        ctx.stroke();
      }
      ctx.fillText(newCode, 15, 20);
    }
  };

  useEffect(() => { drawCaptcha(); }, []);

  const handleChange = (e) => {
    setInput(e.target.value);
    onVerify(e.target.value.toUpperCase() === code);
  };

  return (
    <div className="flex items-center gap-2">
      <canvas ref={canvasRef} width="100" height="40" className="border rounded cursor-pointer" onClick={drawCaptcha} title="點擊重新產生"/>
      <input type="text" placeholder="驗證碼" value={input} onChange={handleChange} className="border rounded p-2 w-24 text-center uppercase" />
      <button type="button" onClick={drawCaptcha} className="p-2 text-gray-500 hover:text-gray-700"><RefreshCw className="w-4 h-4" /></button>
    </div>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-4 mt-6">
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-stone-50 text-stone-600"><ChevronLeft className="w-4 h-4" /> 上一頁</button>
      <span className="text-sm text-stone-600 font-medium">第 {currentPage} 頁 / 共 {totalPages} 頁</span>
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-stone-50 text-stone-600">下一頁 <ChevronRight className="w-4 h-4" /></button>
    </div>
  );
};

// --- Main App Component ---
const AppContent = () => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [isChangePasswordView, setIsChangePasswordView] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [systemLogs, setSystemLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEng, setFilterEng] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('114');
  const [editingId, setEditingId] = useState(null);

  const [listPage, setListPage] = useState(1);
  const [warrantyPage, setWarrantyPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [captchaValid, setCaptchaValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 如果 Firebase 初始化失敗，顯示錯誤畫面
  if (!firebaseInitialized) {
    throw new Error(initError || "Firebase 未知初始化錯誤");
  }

  // --- 1. Firebase Auth ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setAuthError(error.message);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Firestore Listeners ---
  useEffect(() => {
    if (!firebaseUser) return;

    try {
      const projectsRef = collection(db, 'artifacts', currentAppId, 'public', 'data', 'projects');
      const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
        const loadedProjects = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        loadedProjects.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        setProjects(loadedProjects); 
      }, (err) => {
        console.error("Projects Listener Error:", err);
        setAuthError("讀取專案失敗: " + err.message);
      });

      const usersRef = collection(db, 'artifacts', currentAppId, 'public', 'data', 'users');
      const unsubUsers = onSnapshot(usersRef, (snapshot) => {
        const loadedUsers = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        if (loadedUsers.length === 0) {
          addDoc(usersRef, { ...SUPER_ADMIN, password: DEFAULT_ADMIN_PASS });
        } else {
          setUsers(loadedUsers);
        }
      }, (err) => {
        console.error("Users Listener Error:", err);
        setAuthError("讀取使用者失敗: " + err.message);
      });

      return () => { unsubProjects(); unsubUsers(); };
    } catch (e) {
      setAuthError("初始化監聽失敗: " + e.message);
    }
  }, [firebaseUser]);

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return -999;
    const end = new Date(endDateStr);
    const today = new Date();
    const diffTime = end - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    if (!currentUser) return;
    const newLogs = [];
    projects.forEach(p => {
      if (p.hasWarranty && p.warrantyEnd) {
        const days = getDaysRemaining(p.warrantyEnd);
        if (days <= 180 && days > -30) {
           newLogs.push({ id: p.id + days, message: `[系統自動通知] 專案 ${p.id} 保固即將於 ${days} 天後到期。已發信至 Jason@triotechno.com`, time: new Date().toLocaleTimeString() });
        }
      }
    });
    if (newLogs.length > 0) setSystemLogs(newLogs);
  }, [projects, currentUser]);

  useEffect(() => { setListPage(1); }, [searchTerm, filterEng, filterStatus]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!captchaValid) return alert('驗證碼錯誤');
    const foundUser = users.find(u => (u.username === loginUser || u.email === loginUser) && u.password === loginPass);
    if (foundUser) {
      if (foundUser.isFirstLogin) { setCurrentUser(foundUser); setIsLoginView(false); setIsChangePasswordView(true); } 
      else { setCurrentUser(foundUser); setIsLoginView(false); setActiveTab('list'); }
    } else alert('帳號或密碼錯誤');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert('兩次輸入的密碼不一致');
    if (!validateWeakPassword(newPassword)) return alert('密碼強度不足');
    try {
      const userRef = doc(db, 'artifacts', currentAppId, 'public', 'data', 'users', currentUser.firestoreId);
      await updateDoc(userRef, { password: newPassword, isFirstLogin: false });
      alert('密碼修改成功'); setCurrentUser({ ...currentUser, isFirstLogin: false }); setIsChangePasswordView(false); setActiveTab('list');
    } catch (err) { alert('修改失敗: ' + err.message); }
  };

  const handleLogout = () => { setCurrentUser(null); setIsLoginView(true); setLoginUser(''); setLoginPass(''); setCaptchaValid(false); };

  const initialFormState = {
    projectYear: '114', status: '進行中', invoiceDate: new Date().toISOString().split('T')[0], invoiceNumber: '', paymentDate: '', paymentBank: '',
    name: '', type: '新專案', amount: '', school: '', engineer: '', customEngineer: '',
    hasWarranty: false, warrantyStart: '', warrantyEnd: '', hasWarrantyBond: false, warrantyBondAmount: '', maintenanceCost: '', otherCost: '', profitSplitSales: 50, profitSplitEng: 50,
  };
  const [formData, setFormData] = useState(initialFormState);

  const calculations = useMemo(() => {
    const amount = Number(formData.amount) || 0;
    const mgmtFee = Math.round(amount * 0.10); 
    const personnelFee = Math.round(amount * 0.05);
    const maintCost = Number(formData.maintenanceCost) || 0;
    const otherCost = Number(formData.otherCost) || 0;
    const totalCost = mgmtFee + personnelFee + maintCost + otherCost;
    const netProfit = amount - totalCost;
    const salesProfit = Math.round(netProfit * (formData.profitSplitSales / 100));
    const engProfit = Math.round(netProfit * (formData.profitSplitEng / 100));
    return { mgmtFee, personnelFee, totalCost, netProfit, salesProfit, engProfit };
  }, [formData.amount, formData.maintenanceCost, formData.otherCost, formData.profitSplitSales, formData.profitSplitEng]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updates = { [name]: type === 'checkbox' ? checked : value };
      if (name === 'engineer' && !editingId) {
        if (value === 'Sian') { updates.profitSplitSales = 40; updates.profitSplitEng = 60; }
        else if (prev.engineer === 'Sian' && value !== 'Sian') { updates.profitSplitSales = 50; updates.profitSplitEng = 50; }
      }
      return { ...prev, ...updates };
    });
  };

  const handleSplitInput = (type, val) => {
    let num = Number(val); if (num < 0) num = 0; if (num > 100) num = 100;
    setFormData(prev => type === 'sales' ? { ...prev, profitSplitSales: num, profitSplitEng: 100 - num } : { ...prev, profitSplitEng: num, profitSplitSales: 100 - num });
  };

  const handleEdit = (project) => { setEditingId(project.firestoreId); setFormData({ ...project, customEngineer: '' }); setActiveTab('form'); };
  
  const handleDelete = async (id, firestoreId) => { 
    if (window.confirm(`確定刪除 ${id}?`)) {
      try { await deleteDoc(doc(db, 'artifacts', currentAppId, 'public', 'data', 'projects', firestoreId)); } catch(err) { console.error(err); alert("刪除失敗"); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return alert("尚未連線到資料庫");
    const finalEngineer = formData.engineer === 'Other' ? formData.customEngineer : formData.engineer;
    const projectData = { ...formData, engineer: finalEngineer, amount: Number(formData.amount), warrantyBondAmount: Number(formData.warrantyBondAmount) || 0, maintenanceCost: Number(formData.maintenanceCost) || 0, otherCost: Number(formData.otherCost) || 0, ...calculations };
    try {
      if (editingId) {
        const docRef = doc(db, 'artifacts', currentAppId, 'public', 'data', 'projects', editingId);
        await updateDoc(docRef, projectData); alert(`更新成功`); setEditingId(null);
      } else {
        let maxId = 0;
        projects.forEach(p => { const num = parseInt(p.id.substring(1)); if (!isNaN(num) && num > maxId) maxId = num; });
        const newId = `P${String(maxId + 1).padStart(4, '0')}`;
        const colRef = collection(db, 'artifacts', currentAppId, 'public', 'data', 'projects');
        await addDoc(colRef, { id: newId, ...projectData }); alert(`建立成功 ${newId}`);
      }
      setFormData(initialFormState); setActiveTab('list');
    } catch(err) { console.error(err); alert("儲存失敗: " + err.message); }
  };

  const [newUserEmail, setNewUserEmail] = useState('');
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (users.find(u => u.email === newUserEmail)) return alert('Email 已存在');
    const randomPass = generateRandomPassword();
    const newUser = { username: newUserEmail, email: newUserEmail, password: randomPass, role: 'user', isFirstLogin: true };
    try {
      const colRef = collection(db, 'artifacts', currentAppId, 'public', 'data', 'users');
      await addDoc(colRef, newUser);
      window.location.href = `mailto:${newUserEmail}?subject=${encodeURIComponent("【專案管理系統】您的帳號已建立")}&body=${encodeURIComponent(`Hi,\n\n您的帳號已建立。\n帳號: ${newUserEmail}\n密碼: ${randomPass}\n\n請登入後立即修改密碼。`)}`;
      setNewUserEmail(''); alert(`已建立並呼叫郵件軟體。`);
    } catch(err) { alert("建立失敗: " + err.message); }
  };

  const filteredList = useMemo(() => projects.filter(p => {
    const matchText = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase()) || p.invoiceNumber?.includes(searchTerm) || p.invoiceDate.includes(searchTerm);
    const matchEng = filterEng ? p.engineer === filterEng : true;
    const matchStatus = filterStatus ? p.status === filterStatus : true;
    return matchText && matchEng && matchStatus;
  }), [projects, searchTerm, filterEng, filterStatus]);

  const warrantyAlertList = useMemo(() => projects.filter(p => p.hasWarranty).sort((a, b) => new Date(a.warrantyEnd) - new Date(b.warrantyEnd)), [projects]);
  const getPaginatedData = (data, page) => data.slice((page - 1) * ITEMS_PER_PAGE, (page - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE);
  const paginatedList = getPaginatedData(filteredList, listPage);
  const paginatedWarranty = getPaginatedData(warrantyAlertList, warrantyPage);
  const paginatedUsers = getPaginatedData(users, adminPage);

  const stats = useMemo(() => {
    const yearProjects = projects.filter(p => p.projectYear === filterYear);
    const schoolMap = {}; const engNetMap = {}; const typeMap = {};
    yearProjects.forEach(p => { schoolMap[p.school] = (schoolMap[p.school] || 0) + p.netProfit; engNetMap[p.engineer] = (engNetMap[p.engineer] || 0) + p.netProfit; typeMap[p.type] = (typeMap[p.type] || 0) + p.netProfit; });
    const schoolData = Object.entries(schoolMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const engData = Object.entries(engNetMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const totalSalesProfit = yearProjects.reduce((acc, curr) => acc + curr.salesProfit, 0);
    const totalEngProfit = yearProjects.reduce((acc, curr) => acc + curr.engProfit, 0);
    return { schoolData, engData, typeData, splitData: [{ name: '業務端總利潤', value: totalSalesProfit }, { name: '工程端總利潤', value: totalEngProfit }], count: yearProjects.length };
  }, [projects, filterYear]);

  const handleExportExcel = () => {
    const headers = [ "專案編號", "專案年度", "狀態", "發票日期", "發票編號", "入帳日期", "入帳銀行", "專案名稱", "類型", "專案金額", "學校", "工程師", "有保固", "保固開始", "保固結束", "保固金", "管銷費用(10%)", "人事費用(5%)", "維護合約金額", "其他成本", "淨利", "業務分配%", "業務利潤", "工程師分配%", "工程師利潤" ];
    const csvContent = [ headers.join(","), ...filteredList.map(p => [ p.id, p.projectYear, p.status, p.invoiceDate, `"${p.invoiceNumber || ''}"`, p.paymentDate || '', p.paymentBank || '', `"${p.name}"`, p.type, p.amount, `"${p.school}"`, `"${p.engineer}"`, p.hasWarranty ? "是" : "否", p.warrantyStart, p.warrantyEnd, p.warrantyBondAmount, p.mgmtFee, p.personnelFee, p.maintenanceCost, p.otherCost, p.netProfit, `${p.profitSplitSales}%`, p.salesProfit, `${p.profitSplitEng}%`, p.engProfit ].join(",")) ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", `專案報表.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case '進行中': return 'bg-sky-100 text-sky-800 border-sky-200';
      case '保固中': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case '過保固': return 'bg-stone-200 text-stone-600 border-stone-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- RENDER ---
  if (isLoginView) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-stone-200">
        <div className="flex justify-center mb-6"><div className="bg-amber-600 p-3 rounded-full"><DollarSign className="w-8 h-8 text-white" /></div></div>
        <h1 className="text-2xl font-bold text-center text-stone-700 mb-6">專案管理系統</h1>
        {authError ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 text-sm border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold">資料庫連線失敗</p>
              <p>{authError}</p>
              <p className="mt-2 text-xs text-stone-500">請確認 Firebase Console &gt; Authentication &gt; Sign-in method 中的「Anonymous」已啟用。</p>
            </div>
          </div>
        ) : !firebaseUser ? (
          <div className="text-center text-stone-500 py-4">連線到雲端資料庫中...</div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-sm font-medium text-stone-600 mb-1">帳號 / Email</label><input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-amber-500" required /></div>
            <div className="relative"><label className="block text-sm font-medium text-stone-600 mb-1">密碼</label><input type={showPass ? "text" : "password"} value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-amber-500" required /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-8 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
            <div><label className="block text-sm font-medium text-stone-600 mb-1">驗證碼</label><Captcha onVerify={setCaptchaValid} /></div>
            <button type="submit" className="w-full bg-amber-600 text-white py-2 rounded hover:bg-amber-700 transition font-medium">登入系統</button>
          </form>
        )}
        <div className="mt-4 text-center text-xs text-stone-400">預設管理員: triotechno / tri57666</div>
      </div>
    </div>
  );

  if (isChangePasswordView) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border-t-4 border-amber-500">
        <h2 className="text-xl font-bold text-stone-700 mb-2 flex items-center gap-2"><Key className="w-5 h-5 text-amber-600" /> 修改密碼</h2>
        <p className="text-sm text-stone-500 mb-6">首次登入請修改預設密碼。</p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div><label className="block text-sm font-medium text-stone-600 mb-1">新密碼</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-amber-500" required /></div>
          <div><label className="block text-sm font-medium text-stone-600 mb-1">確認新密碼</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-amber-500" required /></div>
          <button type="submit" className="w-full bg-stone-700 text-white py-2 rounded hover:bg-stone-800 transition font-medium">確認修改並登入</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-gray-800 font-sans">
      <nav className="bg-amber-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl"><DollarSign className="w-6 h-6 text-amber-200" />專案管理系統</div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setActiveTab('list')} className={`px-3 py-2 rounded text-sm ${activeTab === 'list' ? 'bg-white text-amber-800' : 'hover:bg-amber-600'}`}><Search className="w-4 h-4 inline mr-1"/> 列表</button>
            <button onClick={() => setActiveTab('warranty')} className={`px-3 py-2 rounded text-sm ${activeTab === 'warranty' ? 'bg-white text-amber-800' : 'hover:bg-amber-600'}`}><ShieldAlert className="w-4 h-4 inline mr-1"/> 監控</button>
            <button onClick={() => { setActiveTab('form'); setEditingId(null); setFormData(initialFormState); }} className={`px-3 py-2 rounded text-sm ${activeTab === 'form' ? 'bg-white text-amber-800' : 'hover:bg-amber-600'}`}><Plus className="w-4 h-4 inline mr-1"/> 建立</button>
            <button onClick={() => setActiveTab('stats')} className={`px-3 py-2 rounded text-sm ${activeTab === 'stats' ? 'bg-white text-amber-800' : 'hover:bg-amber-600'}`}><BarChart2 className="w-4 h-4 inline mr-1"/> 統計</button>
            {currentUser?.role === 'admin' && <button onClick={() => setActiveTab('admin')} className={`px-3 py-2 rounded text-sm ${activeTab === 'admin' ? 'bg-white text-amber-800' : 'bg-red-800 hover:bg-red-700'}`}><Users className="w-4 h-4 inline mr-1"/> 帳號</button>}
            <div className="w-px h-6 bg-amber-500 mx-2"></div>
            <div className="flex items-center gap-2 text-sm"><span className="opacity-80">Hi, {currentUser.username}</span><button onClick={handleLogout} className="p-1 hover:bg-amber-600 rounded"><LogOut className="w-4 h-4" /></button></div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* TAB: FORM */}
        {activeTab === 'form' && (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden animate-fade-in border border-stone-200">
            <div className={`px-6 py-4 border-b ${editingId ? 'bg-orange-100 border-orange-200' : 'bg-gradient-to-r from-orange-600 to-amber-500 border-orange-400'}`}>
              <h2 className={`text-xl font-bold flex items-center gap-2 ${editingId ? 'text-orange-800' : 'text-white'}`}>{editingId ? <Edit className="w-5 h-5"/> : <FileText className="w-5 h-5" />} {editingId ? `編輯專案: ${formData.id}` : '建立新專案'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-stone-700 border-b border-stone-200 pb-2">基本資訊</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">專案年度</label><select name="projectYear" value={formData.projectYear} onChange={handleInputChange} className="w-full border rounded p-2 bg-orange-50">{PROJECT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">狀態</label><select name="status" value={formData.status} onChange={handleInputChange} className="w-full border rounded p-2">{PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">發票日期</label><input type="date" name="invoiceDate" value={formData.invoiceDate} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">發票編號</label><input type="text" name="invoiceNumber" placeholder="AB-12345678" value={formData.invoiceNumber} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">入帳日期</label><input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">入帳銀行</label><select name="paymentBank" value={formData.paymentBank} onChange={handleInputChange} className="w-full border rounded p-2"><option value="">-- 請選擇 --</option>{BANKS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                </div>
                <div><label className="block text-sm font-medium text-stone-600 mb-1">專案名稱</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">類型</label><select name="type" value={formData.type} onChange={handleInputChange} className="w-full border rounded p-2"><option>新專案</option><option>擴充專案</option><option>維護案</option></select></div>
                   <div><label className="block text-sm font-medium text-stone-600 mb-1">金額</label><input type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                </div>
                <div><label className="block text-sm font-medium text-stone-600 mb-1">學校</label><input type="text" name="school" value={formData.school} onChange={handleInputChange} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-stone-600 mb-1">工程師</label><select name="engineer" value={formData.engineer} onChange={handleInputChange} className="w-full border rounded p-2 bg-stone-50"><option value="">-- 請選擇 --</option>{INITIAL_ENGINEERS.map(eng => <option key={eng} value={eng}>{eng}</option>)}<option value="Other">其他</option></select>{formData.engineer === 'Other' && <input type="text" name="customEngineer" placeholder="輸入姓名" value={formData.customEngineer} onChange={handleInputChange} className="w-full mt-2 border p-2 rounded" />}</div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-stone-700 border-b border-stone-200 pb-2">保固與成本</h3>
                <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 space-y-3">
                   <div className="flex items-center gap-2"><input type="checkbox" name="hasWarranty" checked={formData.hasWarranty} onChange={handleInputChange} /> 提供保固</div>
                   {formData.hasWarranty && <div className="grid grid-cols-2 gap-2"><input type="date" name="warrantyStart" value={formData.warrantyStart} onChange={handleInputChange} className="border p-1" /><input type="date" name="warrantyEnd" value={formData.warrantyEnd} onChange={handleInputChange} className="border p-1" /></div>}
                   <div className="flex items-center gap-2"><input type="checkbox" name="hasWarrantyBond" checked={formData.hasWarrantyBond} onChange={handleInputChange} /> 需保固金</div>
                   {formData.hasWarrantyBond && <input type="number" name="warrantyBondAmount" value={formData.warrantyBondAmount} onChange={handleInputChange} className="w-full border p-2" placeholder="金額" />}
                </div>
                <div className="bg-stone-100 p-4 rounded-lg">
                   <div className="grid grid-cols-2 gap-4 mb-2 text-sm text-stone-500"><div>管銷費: {calculations.mgmtFee}</div><div>人事費: {calculations.personnelFee}</div></div>
                   <div className="grid grid-cols-2 gap-4 mb-2"><input type="number" name="maintenanceCost" placeholder="維護合約" value={formData.maintenanceCost} onChange={handleInputChange} className="w-full border p-1" /><input type="number" name="otherCost" placeholder="其他費用" value={formData.otherCost} onChange={handleInputChange} className="w-full border p-1" /></div>
                   <div className="bg-white p-3 rounded font-bold text-lg mb-2 text-center">淨利: ${calculations.netProfit.toLocaleString()}</div>
                   <div className="flex gap-2"><div className="flex-1 text-center"><label className="text-xs">業務%</label><input type="number" value={formData.profitSplitSales} onChange={e => handleSplitInput('sales', e.target.value)} className="w-full border text-center font-bold text-orange-600"/><div>${calculations.salesProfit.toLocaleString()}</div></div><div className="flex-1 text-center"><label className="text-xs">工程%</label><input type="number" value={formData.profitSplitEng} onChange={e => handleSplitInput('eng', e.target.value)} className="w-full border text-center font-bold text-emerald-600"/><div>${calculations.engProfit.toLocaleString()}</div></div></div>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t">
                {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData(initialFormState)}} className="px-4 py-2 bg-gray-200 rounded">取消</button>}
                <button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700">儲存</button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: WARRANTY LIST */}
        {activeTab === 'warranty' && (
          <div className="space-y-4">
             {systemLogs.length > 0 && <div className="bg-stone-800 text-green-400 p-4 rounded font-mono text-xs max-h-40 overflow-y-auto">{systemLogs.map(l => <div key={l.id}>{l.message}</div>)}</div>}
             <div className="grid gap-4">
               {paginatedWarranty.map(p => {
                 const days = getDaysRemaining(p.warrantyEnd);
                 return (
                   <div key={p.id} className={`bg-white p-4 rounded border flex justify-between items-center ${days<=180 && days>=0 ? 'border-red-400' : ''}`}>
                     <div><div className="font-bold">{p.school} - {p.name}</div><div className="text-sm text-gray-500">到期日: {p.warrantyEnd}</div></div>
                     <div className={`font-bold ${days<=180 ? 'text-red-600' : 'text-green-600'}`}>{days < 0 ? '已過期' : `剩餘 ${days} 天`}</div>
                   </div>
                 )
               })}
             </div>
             <Pagination totalItems={warrantyAlertList.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={warrantyPage} onPageChange={setWarrantyPage} />
          </div>
        )}

        {/* TAB: PROJECT LIST */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2 flex-1"><input type="text" placeholder="搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border p-2 rounded w-64" /><select value={filterEng} onChange={e => setFilterEng(e.target.value)} className="border p-2 rounded"><option value="">所有工程師</option>{INITIAL_ENGINEERS.map(e => <option key={e} value={e}>{e}</option>)}</select><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border p-2 rounded"><option value="">所有狀態</option>{PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2"><Download size={16}/> 匯出搜尋結果</button>
            </div>
            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-100 uppercase text-xs">
                  <tr><th className="px-6 py-3">編號/年度</th><th className="px-6 py-3">發票/入帳</th><th className="px-6 py-3">專案</th><th className="px-6 py-3">工程師</th><th className="px-6 py-3 text-right">金額</th><th className="px-6 py-3 text-right">淨利</th><th className="px-6 py-3 text-right">操作</th></tr>
                </thead>
                <tbody>
                  {paginatedList.map(p => (
                    <tr key={p.id} className="border-b hover:bg-orange-50">
                      <td className="px-6 py-4"><div className="font-bold text-orange-700">{p.id}</div><span className={`text-xs px-1 rounded border ${getStatusColor(p.status)}`}>{p.status}</span></td>
                      <td className="px-6 py-4"><div className="text-xs">發票: {p.invoiceNumber || '-'}</div><div className="text-xs text-gray-500">{p.invoiceDate}</div>{p.paymentDate && <div className="text-xs text-green-600 mt-1">入帳: {p.paymentDate}</div>}{p.paymentBank && <div className="text-xs text-gray-500">({p.paymentBank})</div>}</td>
                      <td className="px-6 py-4"><div className="font-bold">{p.name}</div><div className="text-xs text-gray-500">{p.school}</div></td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs border ${getEngineerColor(p.engineer)}`}>{p.engineer}</span></td>
                      <td className="px-6 py-4 text-right">${p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">${p.netProfit.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right"><button onClick={() => handleEdit(p)} className="text-blue-600 mr-2"><Edit size={16}/></button><button onClick={() => handleDelete(p.id, p.firestoreId)} className="text-red-500"><Trash2 size={16}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination totalItems={filteredList.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={listPage} onPageChange={setListPage} />
          </div>
        )}

        {/* TAB: ADMIN */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 border border-stone-200">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users/> 使用者帳號管理</h2>
             <div className="bg-stone-100 p-4 rounded mb-6">
               <h3 className="font-bold mb-2 text-sm text-stone-600">新增使用者</h3>
               <p className="text-xs text-gray-500 mb-2">新增後系統會自動呼叫郵件軟體寄出帳號密碼通知。</p>
               <form onSubmit={handleCreateUser} className="flex gap-2"><input type="email" placeholder="請輸入 Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="flex-1 border p-2 rounded" required /><button type="submit" className="bg-stone-700 text-white px-4 py-2 rounded hover:bg-stone-800 flex items-center gap-2"><UserPlus size={16}/> 建立並寄信</button></form>
             </div>
             <div>
               <h3 className="font-bold mb-2 text-sm text-stone-600">現有使用者列表</h3>
               <table className="w-full text-sm text-left">
                 <thead className="bg-stone-50"><tr><th className="p-2">帳號/Email</th><th className="p-2">權限</th><th className="p-2">狀態</th></tr></thead>
                 <tbody>
                   {paginatedUsers.map((u, idx) => (
                     <tr key={idx} className="border-b"><td className="p-2">{u.username}</td><td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{u.role}</span></td><td className="p-2 text-gray-500">{u.isFirstLogin ? '未啟用' : '正常'}</td></tr>
                   ))}
                 </tbody>
               </table>
               <Pagination totalItems={users.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={adminPage} onPageChange={setAdminPage} />
             </div>
          </div>
        )}
        
        {/* TAB: STATS */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
             <div className="flex justify-between"><h2 className="text-xl font-bold">年度利潤統計</h2><select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="border p-2 rounded">{PROJECT_YEARS.map(y => <option key={y} value={y}>{y} 年</option>)}</select></div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded shadow border"><div className="text-sm text-gray-500">年度總營收</div><div className="text-3xl font-bold text-orange-600">${stats.count > 0 ? projects.filter(p => p.projectYear === filterYear).reduce((a, b) => a + b.amount, 0).toLocaleString() : 0}</div></div>
                <div className="bg-white p-6 rounded shadow border"><div className="text-sm text-gray-500">業務端總利潤</div><div className="text-3xl font-bold text-emerald-600">${stats.splitData[0].value.toLocaleString()}</div></div>
                <div className="bg-white p-6 rounded shadow border"><div className="text-sm text-gray-500">工程端總利潤</div><div className="text-3xl font-bold text-amber-600">${stats.splitData[1].value.toLocaleString()}</div></div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded shadow border border-stone-200">
                    <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4"/> 各校利潤分析 (淨利)</h3>
                    <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.schoolData} layout="vertical" margin={{ left: 10, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} /><RechartsTooltip formatter={(val) => `$${val.toLocaleString()}`} /><Bar dataKey="value" fill="#EA580C" radius={[0, 4, 4, 0]} name="淨利" barSize={20} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-4 rounded shadow border border-stone-200">
                    <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><Users className="w-4 h-4"/> 工程師貢獻分析 (專案淨利)</h3>
                    <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.engData} layout="vertical" margin={{ left: 10, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} /><RechartsTooltip formatter={(val) => `$${val.toLocaleString()}`} /><Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} name="淨利" barSize={20} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-4 rounded shadow border border-stone-200 lg:col-span-2">
                    <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><PieIcon className="w-4 h-4"/> 專案類型利潤分析</h3>
                    <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.typeData} layout="vertical" margin={{ left: 10, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} /><RechartsTooltip formatter={(val) => `$${val.toLocaleString()}`} /><Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} name="淨利" barSize={30} /></BarChart></ResponsiveContainer></div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Wrap AppContent with ErrorBoundary
const App = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;