import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  Link
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  Dog, 
  Calendar, 
  Clock, 
  User, 
  Settings, 
  LogOut, 
  Plus, 
  ChevronRight, 
  History, 
  CreditCard, 
  LayoutDashboard, 
  Users, 
  Scissors, 
  DollarSign,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'customer';
  phoneNumber?: string;
}

interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  notes?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration?: number;
  description?: string;
}

interface Appointment {
  id: string;
  customerId: string;
  petId: string;
  serviceId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  price: number;
  paymentStatus: 'pending' | 'paid';
  createdAt: any;
  petName?: string;
  serviceName?: string;
  customerName?: string;
}

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const variants: any = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
    secondary: 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700 ml-1">{label}</label>}
    <input
      {...props}
      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
    />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="px-6 py-4 border-bottom border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Views ---

const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Create default profile
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Usuário',
          role: 'customer',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center space-y-8"
      >
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
            <Dog size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">VMC PET</h1>
          <p className="text-gray-500 mb-8">O melhor cuidado para o seu melhor amigo.</p>
          
          <Button onClick={handleLogin} className="w-full py-4 text-lg">
            Entrar com Google
          </Button>
          
          <p className="mt-6 text-xs text-gray-400">
            Ao entrar, você concorda com nossos termos de serviço.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Customer Views ---

const CustomerHome = ({ userProfile }: { userProfile: UserProfile }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAddPetOpen, setIsAddPetOpen] = useState(false);
  
  const [newPet, setNewPet] = useState({ name: '', species: 'Cachorro', breed: '', age: '' });
  const [booking, setBooking] = useState({ petId: '', serviceId: '', date: '', time: '' });
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const qPets = query(collection(db, 'pets'), where('ownerId', '==', userProfile.uid));
    const unsubPets = onSnapshot(qPets, (snap) => {
      setPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pet)));
    });

    const qApps = query(
      collection(db, 'appointments'), 
      where('customerId', '==', userProfile.uid),
      orderBy('date', 'desc')
    );
    const unsubApps = onSnapshot(qApps, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    });

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });

    return () => { unsubPets(); unsubApps(); unsubServices(); };
  }, [userProfile.uid]);

  const handleAddPet = async (e: any) => {
    e.preventDefault();
    await addDoc(collection(db, 'pets'), {
      ...newPet,
      ownerId: userProfile.uid,
      age: Number(newPet.age)
    });
    setIsAddPetOpen(false);
    setNewPet({ name: '', species: 'Cachorro', breed: '', age: '' });
  };

  const handleBooking = async (e: any) => {
    e.preventDefault();
    const service = services.find(s => s.id === booking.serviceId);
    
    setIsPaying(true);
    // Simulate Payment Gateway (Mercado Pago / PagSeguro)
    setTimeout(async () => {
      await addDoc(collection(db, 'appointments'), {
        ...booking,
        customerId: userProfile.uid,
        status: 'pending',
        paymentStatus: 'paid', // Simulated paid status
        price: service?.price || 0,
        createdAt: serverTimestamp()
      });
      setIsPaying(false);
      setIsBookingOpen(false);
      setBooking({ petId: '', serviceId: '', date: '', time: '' });
    }, 2000);
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      <header className="p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Olá, {userProfile.displayName.split(' ')[0]}!</h2>
          <p className="text-gray-500 text-sm">Como está seu pet hoje?</p>
        </div>
        <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <div className="px-6 space-y-8">
        {/* Pets Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Meus Pets</h3>
            <button onClick={() => setIsAddPetOpen(true)} className="text-emerald-600 text-sm font-medium flex items-center gap-1">
              <Plus size={16} /> Adicionar
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {pets.map(pet => (
              <div key={pet.id} className="flex-shrink-0 w-32 bg-white p-4 rounded-2xl border border-gray-100 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <Dog size={24} />
                </div>
                <p className="font-medium text-gray-900 truncate">{pet.name}</p>
                <p className="text-xs text-gray-400">{pet.species}</p>
              </div>
            ))}
            {pets.length === 0 && (
              <p className="text-gray-400 text-sm py-4">Nenhum pet cadastrado.</p>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setIsBookingOpen(true)}
            className="bg-emerald-600 p-6 rounded-3xl text-white text-left space-y-3 shadow-lg shadow-emerald-200"
          >
            <Calendar size={24} />
            <div>
              <p className="font-semibold">Agendar</p>
              <p className="text-xs text-emerald-100">Banho e Tosa</p>
            </div>
          </button>
          <button className="bg-white p-6 rounded-3xl text-gray-900 text-left space-y-3 border border-gray-100 shadow-sm">
            <CreditCard size={24} className="text-emerald-600" />
            <div>
              <p className="font-semibold">Pagamentos</p>
              <p className="text-xs text-gray-400">Histórico e faturas</p>
            </div>
          </button>
        </section>

        {/* Upcoming Appointments */}
        <section>
          <h3 className="font-semibold text-gray-900 mb-4">Próximos Serviços</h3>
          <div className="space-y-3">
            {appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled').map(app => (
              <Card key={app.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <Clock size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {services.find(s => s.id === app.serviceId)?.name || 'Serviço'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(parseISO(app.date), "dd 'de' MMMM", { locale: ptBR })} às {app.time}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {app.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                </div>
              </Card>
            ))}
            {appointments.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">Nenhum agendamento futuro.</p>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      <Modal isOpen={isAddPetOpen} onClose={() => setIsAddPetOpen(false)} title="Novo Pet">
        <form onSubmit={handleAddPet} className="space-y-4">
          <Input label="Nome do Pet" required value={newPet.name} onChange={(e: any) => setNewPet({...newPet, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 ml-1">Espécie</label>
              <select 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={newPet.species}
                onChange={(e: any) => setNewPet({...newPet, species: e.target.value})}
              >
                <option>Cachorro</option>
                <option>Gato</option>
                <option>Outro</option>
              </select>
            </div>
            <Input label="Idade" type="number" value={newPet.age} onChange={(e: any) => setNewPet({...newPet, age: e.target.value})} />
          </div>
          <Input label="Raça" value={newPet.breed} onChange={(e: any) => setNewPet({...newPet, breed: e.target.value})} />
          <Button type="submit" className="w-full">Salvar Pet</Button>
        </form>
      </Modal>

      <Modal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} title="Agendar Serviço">
        <form onSubmit={handleBooking} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 ml-1">Selecione o Pet</label>
            <select 
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={booking.petId}
              onChange={(e: any) => setBooking({...booking, petId: e.target.value})}
            >
              <option value="">Escolha um pet</option>
              {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 ml-1">Serviço</label>
            <select 
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={booking.serviceId}
              onChange={(e: any) => setBooking({...booking, serviceId: e.target.value})}
            >
              <option value="">Escolha o serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.price}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" type="date" required value={booking.date} onChange={(e: any) => setBooking({...booking, date: e.target.value})} />
            <Input label="Hora" type="time" required value={booking.time} onChange={(e: any) => setBooking({...booking, time: e.target.value})} />
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-bold text-emerald-700">
                R$ {services.find(s => s.id === booking.serviceId)?.price || 0}
              </span>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPaying}>
            {isPaying ? 'Processando Pagamento...' : 'Pagar e Agendar'}
          </Button>
          <p className="text-[10px] text-center text-gray-400">
            Pagamento processado com segurança via Mercado Pago
          </p>
        </form>
      </Modal>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-8 py-4 flex justify-between items-center z-40">
        <button className="text-emerald-600"><LayoutDashboard size={24} /></button>
        <button className="text-gray-400"><Calendar size={24} /></button>
        <button className="text-gray-400"><History size={24} /></button>
        <button className="text-gray-400"><User size={24} /></button>
      </nav>
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard = ({ userProfile }: { userProfile: UserProfile }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState({ today: 0, pending: 0, revenue: 0 });
  const [activeTab, setActiveTab] = useState('overview');
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    customerId: '',
    petId: '',
    serviceId: '',
    date: '',
    time: '',
  });

  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'appointments'), (snap) => {
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      setAppointments(apps);
      
      const today = apps.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length;
      const pending = apps.filter(a => a.status === 'pending').length;
      const revenue = apps.filter(a => a.paymentStatus === 'paid').reduce((acc, curr) => acc + curr.price, 0);
      
      setStats({ today, pending, revenue });
    });

    const unsubClients = onSnapshot(collection(db, 'users'), (snap) => {
      setClients(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    });

    const unsubPets = onSnapshot(collection(db, 'pets'), (snap) => {
      setPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pet)));
    });

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });

    return () => {
      unsubApps();
      unsubClients();
      unsubPets();
      unsubServices();
    };
  }, []);

  const handleAdminBooking = async (e: any) => {
    e.preventDefault();
    const service = services.find(s => s.id === newAppointment.serviceId);
    await addDoc(collection(db, 'appointments'), {
      ...newAppointment,
      status: 'confirmed',
      paymentStatus: 'pending',
      price: service?.price || 0,
      createdAt: serverTimestamp()
    });
    setIsNewAppointmentOpen(false);
    setNewAppointment({ customerId: '', petId: '', serviceId: '', date: '', time: '' });
  };

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'appointments', id), { status });
  };

  const updatePayment = async (id: string, paymentStatus: string) => {
    await updateDoc(doc(db, 'appointments', id), { paymentStatus });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <Dog size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">VMC PET</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Visão Geral' },
            { id: 'clients', icon: Users, label: 'Clientes & Pets' },
            { id: 'services', icon: Scissors, label: 'Serviços' },
            { id: 'cash', icon: DollarSign, label: 'Financeiro' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <button onClick={() => signOut(auth)} className="mt-auto flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          Sair
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-500">Bem-vindo de volta, Administrador.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="secondary"><MessageCircle size={18} /> WhatsApp</Button>
            <Button onClick={() => setIsNewAppointmentOpen(true)}><Plus size={18} /> Novo Agendamento</Button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-6">
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.today} Agendamentos</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pendentes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending} Aguardando</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Receita Total</p>
                  <p className="text-2xl font-bold text-gray-900">R$ {stats.revenue.toLocaleString()}</p>
                </div>
              </Card>
            </div>

            {/* Recent Appointments Table */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-6">Agenda de Hoje</h3>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Horário</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Pet / Cliente</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Serviço</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Pagamento</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {appointments.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).map(app => {
                      const pet = pets.find(p => p.id === app.petId);
                      const customer = clients.find(c => c.uid === app.customerId);
                      const service = services.find(s => s.id === app.serviceId);
                      
                      return (
                        <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{app.time}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{pet?.name || 'Pet removido'}</span>
                              <span className="text-xs text-gray-500">{customer?.displayName || 'Cliente removido'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{service?.name || 'Serviço removido'}</td>
                          <td className="px-6 py-4">
                            <select 
                              value={app.status}
                              onChange={(e) => updateStatus(app.id, e.target.value)}
                              className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg border-0 focus:ring-0 cursor-pointer ${
                                app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 
                                app.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              <option value="pending">Pendente</option>
                              <option value="confirmed">Confirmado</option>
                              <option value="completed">Concluído</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => updatePayment(app.id, app.paymentStatus === 'paid' ? 'pending' : 'paid')}
                              className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                                app.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {app.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <button className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
                              <MessageCircle size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <Modal isOpen={isNewAppointmentOpen} onClose={() => setIsNewAppointmentOpen(false)} title="Novo Agendamento (Admin)">
          <form onSubmit={handleAdminBooking} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 ml-1">Cliente</label>
              <select 
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={newAppointment.customerId}
                onChange={(e: any) => setNewAppointment({...newAppointment, customerId: e.target.value, petId: ''})}
              >
                <option value="">Selecione um cliente</option>
                {clients.filter(c => c.role === 'customer').map(c => (
                  <option key={c.uid} value={c.uid}>{c.displayName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 ml-1">Pet</label>
              <select 
                required
                disabled={!newAppointment.customerId}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50"
                value={newAppointment.petId}
                onChange={(e: any) => setNewAppointment({...newAppointment, petId: e.target.value})}
              >
                <option value="">Selecione o pet</option>
                {pets.filter(p => p.ownerId === newAppointment.customerId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 ml-1">Serviço</label>
              <select 
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={newAppointment.serviceId}
                onChange={(e: any) => setNewAppointment({...newAppointment, serviceId: e.target.value})}
              >
                <option value="">Escolha o serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.price}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Data" type="date" required value={newAppointment.date} onChange={(e: any) => setNewAppointment({...newAppointment, date: e.target.value})} />
              <Input label="Hora" type="time" required value={newAppointment.time} onChange={(e: any) => setNewAppointment({...newAppointment, time: e.target.value})} />
            </div>

            <Button type="submit" className="w-full">Criar Agendamento</Button>
          </form>
        </Modal>
      </main>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let profile: UserProfile;
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
          // Auto-promote to admin if email matches
          if (profile.email === 'snegs.adm@gmail.com' && profile.role !== 'admin') {
            await updateDoc(userDocRef, { role: 'admin' });
            profile.role = 'admin';
          }
        } else {
          // Create default profile
          const role = firebaseUser.email === 'snegs.adm@gmail.com' ? 'admin' : 'customer';
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Usuário',
            role: role as 'admin' | 'customer',
          };
          await setDoc(userDocRef, {
            ...profile,
            createdAt: serverTimestamp()
          });
        }
        setUserProfile(profile);

        // Seed services if admin
        if (profile.role === 'admin') {
          const servicesSnap = await getDoc(doc(db, 'services', 'seed_check'));
          if (!servicesSnap.exists()) {
            const defaultServices = [
              { name: 'Banho Simples', price: 50, duration: 60 },
              { name: 'Banho e Tosa', price: 90, duration: 120 },
              { name: 'Tosa Higiênica', price: 40, duration: 45 },
              { name: 'Corte de Unha', price: 20, duration: 15 },
            ];
            for (const s of defaultServices) {
              await addDoc(collection(db, 'services'), s);
            }
            await setDoc(doc(db, 'services', 'seed_check'), { seeded: true });
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Routes>
          <Route 
            path="/" 
            element={
              !user ? <Login /> : 
              userProfile?.role === 'admin' ? <AdminDashboard userProfile={userProfile} /> : 
              userProfile ? <CustomerHome userProfile={userProfile} /> : <Login />
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
