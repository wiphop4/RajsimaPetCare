import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, getDoc, updateDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'; // Imported Timestamp
import jsPDF from 'jspdf';

// API Key for Gemini Model - REPLACE WITH YOUR ACTUAL KEY
const apiKey = "AIzaSyDtjCd_qmSayKpjxRtpt2BdpF4IDnTTY2g";

// App Context Type for global state management
interface AppContextType {
  user: any;
  db: any;
  auth: any;
  setCurrentPage: (page: string) => void;
  setSelectedAnimal: (animal: any) => void;
}

// Animal Interface - Added ownerId for linking to user's data
interface Animal {
  id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  hn: string;
  createdAt: Date;
  ownerId: string; // Added ownerId to link animal to its owner
}

// Illness Record Interface - Added treatment field
interface IllnessRecord {
  id?: string; // Optional ID for fetched records
  symptoms: string;
  temperature: string;
  heartRate?: string;
  respiratoryRate?: string;
  bloodPressure?: string;
  oxygenSaturation?: string;
  diagnosis: string;
  treatment: string; // Added treatment field
  timestamp: Date | Timestamp; // Updated to allow Date or Timestamp
  image?: string; // Optional: Base64 image data
}

// Props interfaces for components
interface RecordIllnessFormProps {
  animal: Animal;
  onClose: () => void;
}

interface AnimalDetailProps {
  animal: Animal;
}

const AppContext = createContext<AppContextType | null>(null);

// Header Component
function Header() {
  const context = useContext(AppContext);
  if (!context) throw new Error("Header must be used within an AppContext.Provider");
  // Removed setCurrentPage from destructuring to avoid ESLint 'unused' warning
  const { auth, user } = context; 

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
  const userId = user?.uid || 'N/A';

  return (
    <header className="bg-blue-600 text-white p-4 shadow-md rounded-b-lg">
      <div className="container mx-auto flex justify-between items-center max-w-4xl">
        <h1 className="text-3xl font-bold">
          <span className="text-yellow-300">Pet</span>Care
        </h1>
        <nav className="flex items-center space-x-4">
          <button
            onClick={() => context.setCurrentPage('dashboard')} // Use context.setCurrentPage directly
            className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 transition duration-200"
          >
            สัตว์เลี้ยงของฉัน <br/> My Pets
          </button>
          <button
            onClick={() => context.setCurrentPage('vet-search')} // Use context.setCurrentPage directly
            className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 transition duration-200"
          >
            ค้นหาสัตวแพทย์ <br/> Find Veterinarian
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 transition duration-200"
          >
            ออกจากระบบ <br/> Logout
          </button>
        </nav>
      </div>
      <div className="container mx-auto mt-2 text-sm text-right max-w-4xl">
        User ID: {userId}
        <br/>
        App ID: {appId}
      </div>
    </header>
  );
}

// Authentication Page Component
function AuthPage() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AuthPage must be used within an AppContext.Provider");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { auth, setCurrentPage, db } = context;

  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<string>('user');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage('เข้าสู่ระบบสำเร็จ! / Login successful!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user && db) {
          const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
          const userProfileDocRef = doc(db, 'artifacts', appId, 'users', userCredential.user.uid, 'profile', 'data');
          await setDoc(userProfileDocRef, { email: email, role: role, lastHNNumber: 0 });
        }
        setMessage('ลงทะเบียนสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว / Registration successful! You can now log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let displayError = err.message;
      if (err.code === 'auth/invalid-email') {
        displayError = 'อีเมลไม่ถูกต้อง / Invalid email.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        displayError = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง / Incorrect email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        displayError = 'อีเมลนี้ถูกใช้แล้ว / Email already in use.';
      } else if (err.code === 'auth/weak-password') {
        displayError = 'รหัสผ่านอ่อนแอเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร) / Password is too weak (min 6 characters).';
      }
      setError(displayError);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md transform transition-all duration-300">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {isLogin ? 'เข้าสู่ระบบ / Login' : 'ลงทะเบียน / Register'}
        </h2>
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        {message && <p className="text-green-600 text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">อีเมล / Email</label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 transition duration-200"
              placeholder="your@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">รหัสผ่าน / Password</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 transition duration-200"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <div>
              <label htmlFor="role" className="block text-gray-700 text-sm font-semibold mb-2">คุณคือใคร? / Who are you?</label>
              <select
                id="role"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 transition duration-200"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">เลือกบทบาท / Select Role</option>
                <option value="user">ผู้ใช้ทั่วไป / User</option>
                <option value="veterinarian">สัตวแพทย์ / Veterinarian</option>
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold text-lg hover:bg-blue-700 transition duration-200 shadow-sm"
          >
            {isLogin ? 'เข้าสู่ระบบ / Login' : 'ลงทะเบียน / Register'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline text-sm"
          >
            {isLogin ? 'ยังไม่มีบัญชี? ลงทะเบียนที่นี่ / No account? Register here.' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบที่นี่ / Already have an account? Login here.'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dashboard for Regular Users
function Dashboard() {
  const context = useContext(AppContext);
  if (!context) throw new Error("Dashboard must be used within an AppContext.Provider");
  const { user, db, setCurrentPage, setSelectedAnimal } = context;

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!user || !db) return;

    const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
    const userId = user.uid;
    const animalsCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'animals');

    const unsubscribe = onSnapshot(animalsCollectionRef, (snapshot) => {
      const animalsList: Animal[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ownerId: userId // Explicitly set ownerId from the collection path
      } as Animal));
      setAnimals(animalsList);
      setLoadingAnimals(false);
    }, (err: any) => {
      console.error("Error fetching animals:", err);
      setError("ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้ / Failed to load pet data.");
      setLoadingAnimals(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleViewAnimal = (animal: Animal) => {
    setSelectedAnimal(animal);
    setCurrentPage('animal-detail');
  };

  if (loadingAnimals) {
    return (
      <div className="text-center text-gray-600 flex items-center justify-center h-full">
        <svg className="animate-spin h-8 w-8 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        กำลังโหลดสัตว์เลี้ยง... / Loading pets...
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600">{error}</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">สัตว์เลี้ยงของฉัน / My Pets</h2>
      <button
        onClick={() => setCurrentPage('add-animal')}
        className="mb-6 px-6 py-3 bg-green-600 text-white rounded-md font-semibold text-lg hover:bg-green-700 transition duration-200 shadow-sm flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        เพิ่มสัตว์เลี้ยงใหม่ / Add New Pet
      </button>

      {animals.length === 0 ? (
        <p className="text-gray-600 text-center text-lg">คุณยังไม่มีสัตว์เลี้ยงในระบบ ลองเพิ่มตัวแรกดูสิ! / You don't have any pets yet. Try adding one!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {animals.map((animal) => (
            <div
              key={animal.id}
              className="bg-blue-50 p-5 rounded-md shadow-sm border border-blue-200 cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 transition duration-200"
              onClick={() => handleViewAnimal(animal)}
            >
              <h3 className="text-xl font-semibold text-blue-800 mb-2">{animal.name}</h3>
              <p className="text-gray-700 text-sm">HN: <span className="font-medium">{animal.hn}</span></p>
              <p className="text-gray-700 text-sm">ชนิด: <span className="font-medium">{animal.species}</span></p>
              <p className="text-gray-700 text-sm">พันธุ์: <span className="font-medium">{animal.breed}</span></p>
              <p className="text-gray-700 text-sm">เพศ: <span className="font-medium">{animal.sex}</span></p>
              <div className="mt-3 text-right">
                <button className="text-blue-600 hover:underline text-sm font-medium">ดูรายละเอียด / View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-200">
        <h3 className="text-2xl font-bold text-purple-800 mb-4">เคล็ดลับการดูแลสัตว์เลี้ยง / Pet Care Tips</h3>
        <ul className="list-disc list-inside text-gray-700 space-y-2">
          <li>
            <span className="font-semibold">การให้อาหารที่เหมาะสม:</span> เลือกอาหารที่มีคุณภาพและเหมาะสมกับวัย พันธุ์ และกิจกรรมของสัตว์เลี้ยง
            <br/>
            <span className="font-semibold">Proper Feeding:</span> Choose high-quality food suitable for your pet's age, breed, and activity level.
          </li>
          <li>
            <span className="font-semibold">การออกกำลังกายสม่ำเสมอ:</span> พาออกกำลังกายเป็นประจำเพื่อสุขภาพที่ดีและป้องกันโรคอ้วน
            <br/>
            <span className="font-semibold">Regular Exercise:</span> Provide consistent exercise for good health and to prevent obesity.
          </li>
          <li>
            <span className="font-semibold">การดูแลสุขอนามัย:</span> แปรงขน อาบน้ำ และดูแลช่องปากเป็นประจำ
            <br/>
            <span className="font-semibold">Hygiene Care:</span> Regularly brush fur, bathe, and maintain oral hygiene.
          </li>
          <li>
            <span className="font-semibold">การฉีดวัคซีนและถ่ายพยาธิ:</span> ปรึกษาสัตวแพทย์เพื่อโปรแกรมวัคซีนและการถ่ายพยาธิที่เหมาะสม
            <br/>
            <span className="font-semibold">Vaccinations and Deworming:</span> Consult a veterinarian for appropriate vaccination and deworming schedules.
          </li>
          <li>
            <span className="font-semibold">การสังเกตอาการผิดปกติ:</span> หมั่นสังเกตพฤติกรรม อาการเจ็บป่วย หรือการเปลี่ยนแปลงทางร่างกาย และปรึกษาสัตวแพทย์หากพบสิ่งผิดปกติ
            <br/>
            <span className="font-semibold">Observe for Abnormalities:</span> Regularly monitor behavior, signs of illness, or physical changes, and consult a veterinarian if anything unusual is observed.
          </li>
        </ul>
      </div>
    </div>
  );
}

// Veterinarian Dashboard Component
function VetDashboard() {
  const context = useContext(AppContext);
  if (!context) throw new Error("VetDashboard must be used within an AppContext.Provider");
  const { db, setCurrentPage, setSelectedAnimal } = context;

  const [searchHN, setSearchHN] = useState<string>('');
  const [foundAnimal, setFoundAnimal] = useState<Animal | null>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);

  const handleSearchByHN = async (e: React.FormEvent) => {
    e.preventDefault();
    setFoundAnimal(null);
    setSearchError('');
    setMessage('');
    setLoadingSearch(true);

    console.log("Searching for HN:", searchHN);

    if (!searchHN) {
      setSearchError("กรุณากรอก HN ที่ต้องการค้นหา / Please enter an HN to search.");
      setLoadingSearch(false);
      return;
    }

    try {
      const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
      console.log("App ID used for users collection:", appId);

      const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
      const userDocs = await getDocs(usersCollectionRef);

      let animalFound: Animal | null = null;

      if (userDocs.empty) {
        console.log("No user documents found in Firestore in the 'users' collection.");
        setSearchError("ไม่พบข้อมูลผู้ใช้ในระบบ / No user data found in the system.");
        setLoadingSearch(false);
        return;
      }

      for (const userDoc of userDocs.docs) {
        const userId = userDoc.id;
        console.log(`Checking animals for user ID: ${userId}`);

        const animalsCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'animals');
        const q = query(animalsCollectionRef, where("hn", "==", searchHN));
        const animalSnapshots = await getDocs(q);

        if (!animalSnapshots.empty) {
          // Found the animal, add ownerId to the animal object before setting it
          animalFound = { id: animalSnapshots.docs[0].id, ...animalSnapshots.docs[0].data(), ownerId: userId } as Animal;
          console.log(`Animal found for HN '${searchHN}' under user ID: ${userId}`, animalFound);
          break;
        } else {
          console.log(`No animal found for HN '${searchHN}' under user ID: ${userId}`);
        }
      }

      if (animalFound) {
        setFoundAnimal(animalFound);
        setMessage(`พบสัตว์เลี้ยงแล้ว (เจ้าของ: ${animalFound.ownerId}) / Pet found (Owner: ${animalFound.ownerId}).`);
      } else {
        setSearchError("ไม่พบสัตว์เลี้ยงด้วย HN นี้ / No pet found with this HN.");
      }

    } catch (err: any) {
      console.error("Error searching animal by HN:", err);
      setSearchError("เกิดข้อผิดพลาดในการค้นหา: " + err.message + " / Error during search: " + err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleViewFoundAnimal = () => {
    if (foundAnimal) {
      setSelectedAnimal(foundAnimal);
      setCurrentPage('animal-detail');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">แดชบอร์ดสัตวแพทย์ / Veterinarian Dashboard</h2>
      <p className="text-gray-700 mb-4">ค้นหาสัตว์เลี้ยงด้วย HN เพื่อดูข้อมูลและวินิจฉัย / Search for a pet by HN to view its details and diagnose.</p>
      <p className="text-gray-600 text-sm mb-4">
        **โปรดกรอก HN ให้ครบถ้วน** เช่น `HN-ABCD-0001` (ส่วน `ABCD` มาจาก User ID ของเจ้าของสัตว์เลี้ยง)
        <br/>
        **Please enter the full HN**, e.g., `HN-ABCD-0001` (the `ABCD` part comes from the pet owner's User ID).
      </p>

      <form onSubmit={handleSearchByHN} className="flex items-center space-x-4 mb-6">
        <input
          type="text"
          className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
          placeholder="กรอก HN สัตว์เลี้ยง / Enter Pet HN"
          value={searchHN}
          onChange={(e) => setSearchHN(e.target.value)}
          required
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 transition duration-200 shadow-sm"
          disabled={loadingSearch}
        >
          {loadingSearch ? 'กำลังค้นหา... / Searching...' : 'ค้นหา / Search'}
        </button>
      </form>

      {searchError && <p className="text-red-600 mb-4">{searchError}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}
      {foundAnimal && (
        <div className="bg-blue-50 p-5 rounded-md shadow-sm border border-blue-200 mt-4">
          <h3 className="text-xl font-semibold text-blue-800 mb-2">พบสัตว์เลี้ยง: {foundAnimal.name} / Pet Found: {foundAnimal.name}</h3>
          <p className="text-gray-700 text-sm">HN: <span className="font-medium">{foundAnimal.hn}</span></p>
          <p className="text-gray-700 text-sm">ชนิด: <span className="font-medium">{foundAnimal.species}</span></p>
          <p className="text-gray-700 text-sm">พันธุ์: <span className="font-medium">{foundAnimal.breed}</span></p>
          <p className="text-gray-700 text-sm">เพศ: <span className="font-medium">{foundAnimal.sex}</span></p>
          <div className="mt-3 text-right">
            <button
              onClick={handleViewFoundAnimal}
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              ดูรายละเอียดและวินิจฉัย / View Details & Diagnose
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Animal Form Component
function AddAnimalForm() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AddAnimalForm must be used within an AppContext.Provider");
  const { user, db, setCurrentPage } = context;

  const [name, setName] = useState<string>('');
  const [species, setSpecies] = useState<string>('');
  const [breed, setBreed] = useState<string>('');
  const [sex, setSex] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!user || !db) {
      setError("ผู้ใช้ไม่ได้เข้าสู่ระบบหรือฐานข้อมูลไม่พร้อมใช้งาน / User not logged in or database not ready.");
      return;
    }

    try {
      const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
      const userId = user.uid;
      const animalsCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'animals');
      const userProfileDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');

      const userProfileSnap = await getDoc(userProfileDocRef);
      let nextHNNumber = 1;
      if (userProfileSnap.exists()) {
        const userData = userProfileSnap.data();
        nextHNNumber = (userData?.lastHNNumber || 0) + 1;
      }

      const hn = `HN-${userId.substring(0, 4).toUpperCase()}-${nextHNNumber.toString().padStart(4, '0')}`;

      await addDoc(animalsCollectionRef, {
        name,
        species,
        breed,
        sex,
        hn,
        createdAt: new Date(),
        ownerId: userId, // Store the owner's ID with the animal
      });

      await updateDoc(userProfileDocRef, { lastHNNumber: nextHNNumber });

      setMessage('เพิ่มสัตว์เลี้ยงสำเร็จ! / Pet added successfully!');
      setName('');
      setSpecies('');
      setBreed('');
      setSex('');
      setCurrentPage('dashboard');
    } catch (err: any) {
      console.error("Error adding animal:", err);
      setError("ไม่สามารถเพิ่มสัตว์เลี้ยงได้: " + err.message + " / Failed to add pet: " + err.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">เพิ่มสัตว์เลี้ยงใหม่ / Add New Pet</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-gray-700 text-sm font-semibold mb-2">ชื่อสัตว์เลี้ยง / Pet Name</label>
          <input
            type="text"
            id="name"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="species" className="block text-gray-700 text-sm font-semibold mb-2">ชนิด (เช่น สุนัข, แมว, นก) / Species (e.g., Dog, Cat, Bird)</label>
          <input
            type="text"
            id="species"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="breed" className="block text-gray-700 text-sm font-semibold mb-2">พันธุ์ (เช่น Golden Retriever, Persian) / Breed (e.g., Golden Retriever, Persian)</label>
          <input
            type="text"
            id="breed"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="sex" className="block text-gray-700 text-sm font-semibold mb-2">เพศ / Sex</label>
          <select
            id="sex"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            required
          >
            <option value="">เลือกเพศ / Select Sex</option>
            <option value="Male">ผู้ / Male</option>
            <option value="Female">เมีย / Female</option>
          </select>
        </div>
        <div className="flex justify-between space-x-4">
          <button
            type="button"
            onClick={() => setCurrentPage('dashboard')}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md font-semibold text-lg hover:bg-gray-600 transition duration-200 shadow-sm"
          >
            ยกเลิก / Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 transition duration-200 shadow-sm"
          >
            บันทึกสัตว์เลี้ยง / Save Pet
          </button>
        </div>
      </form>
    </div>
  );
}

// Record Illness Form Component
function RecordIllnessForm({ animal, onClose }: RecordIllnessFormProps) {
  const context = useContext(AppContext);
  if (!context) throw new Error("RecordIllnessForm must be used within an AppContext.Provider");
  const { user, db } = context;

  const [symptoms, setSymptoms] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [bloodPressure, setBloodPressure] = useState<string>('');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatment, setTreatment] = useState<string>(''); // New state for treatment
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImageBase64(null);
    }
  };

  const handleAIDiagnosis = async () => {
    setError('');
    setDiagnosis('');
    setLoadingAI(true);

    if (!symptoms && !selectedImageBase64) {
      setError("กรุณากรอกอาการหรืออัปโหลดรูปภาพเพื่อวินิจฉัย / Please enter symptoms or upload an image for diagnosis.");
      setLoadingAI(false);
      return;
    }

    try {
      let englishSymptoms = symptoms;
      if (symptoms) {
        const translationPrompt = `Translate the following Thai text to English: "${symptoms}"`;
        const translationPayload = { contents: [{ role: "user", parts: [{ text: translationPrompt }] }] };
        const translationApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const translationResponse = await fetch(translationApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(translationPayload) // Corrected: Used translationPayload
        });
        const translationResult = await translationResponse.json();

        if (translationResponse.ok && translationResult.candidates && translationResult.candidates.length > 0 &&
            translationResult.candidates[0].content && translationResult.candidates[0].content.parts &&
            translationResult.candidates[0].content.parts.length > 0) {
            englishSymptoms = translationResult.candidates[0].content.parts[0].text.trim();
            if (englishSymptoms.startsWith('"') && englishSymptoms.endsWith('"')) {
                englishSymptoms = englishSymptoms.slice(1, -1);
            }
        } else {
            console.error("Translation AI response error:", translationResult.error || "Unknown error");
            console.error("Translation AI response structure unexpected or empty. Full response:", translationResult);
            console.warn("Could not translate symptoms, proceeding with original text.");
        }
      }

      let promptText = `
        For a pet named ${animal.name} (HN: ${animal.hn}, Species: ${animal.species}, Breed: ${animal.breed}, Sex: ${animal.sex}), observed symptoms are:
        Thai: "${symptoms}"
        English: "${englishSymptoms}"
        Temperature: ${temperature || 'Not specified'}.
        Additional device data:
        Heart Rate: ${heartRate || 'Not specified'}
        Respiratory Rate: ${respiratoryRate || 'Not specified'}
        Blood Pressure: ${bloodPressure || 'Not specified'}
        Oxygen Saturation: ${oxygenSaturation || 'Not specified'}
      `;

      if (selectedImageBase64) {
        promptText += `\n\nAnalyze the provided image for any additional clues related to the symptoms.`;
      }

      promptText += `
        Please provide 1-2 possible preliminary diagnoses and short advice for the pet owner.
        The response should be structured as follows:
        Thai: [Your diagnosis and advice in Thai]
        English: [Your diagnosis and advice in English]
        Emphasize that this is a preliminary diagnosis and a veterinarian should be consulted.
      `;

      const chatHistoryParts: any[] = [{ text: promptText }];

      if (selectedImageBase64) {
        chatHistoryParts.push({
          inlineData: {
            mimeType: "image/png",
            data: selectedImageBase64
          }
        });
      }

      const payload = {
        contents: [{
          role: "user",
          parts: chatHistoryParts
        }]
      };

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        if (text !== undefined && text !== null) { // Added check for undefined and null
          setDiagnosis(text);
        } else {
          setError("AI response text was empty or invalid. Failed to get AI diagnosis.");
          console.error("AI diagnosis response text is undefined/null. Full response:", result);
        }
      } else {
        setError("ไม่สามารถรับการวินิจฉัยจาก AI ได้ / Failed to get AI diagnosis.");
        console.error("AI diagnosis response error:", result.error || "Unknown error");
        console.error("AI diagnosis response structure unexpected or empty. Full response:", result);
      }
    } catch (err: any) {
      console.error("Error calling Gemini API:", err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ AI: " + err.message + " / Error connecting to AI: " + err.message);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSaveAndGeneratePDF = async () => {
    setError('');
    setMessage('');

    if (!user || !db) {
      setError("ผู้ใช้ไม่ได้เข้าสู่ระบบหรือฐานข้อมูลไม่พร้อมใช้งาน / User not logged in or database not ready.");
      return;
    }

    if ((!symptoms && !selectedImageBase64) || !diagnosis) {
      setError("กรุณากรอกอาการหรืออัปโหลดรูปภาพ และทำการวินิจฉัย AI ก่อนสร้าง PDF / Please enter symptoms or upload an image, and get AI diagnosis before creating PDF.");
      return;
    }

    // Explicitly check if animal, animal.ownerId, or animal.id are defined
    if (!animal || !animal.ownerId || !animal.id) {
      const errorMessage = "ข้อมูลสัตว์เลี้ยงไม่สมบูรณ์ ไม่สามารถบันทึกประวัติอาการป่วยได้ / Incomplete pet data. Cannot save illness record.";
      setError(errorMessage);
      console.error("Error in handleSaveAndGeneratePDF: Missing animal data.", {
        animal: animal,
        ownerId: animal?.ownerId,
        animalId: animal?.id
      });
      return;
    }

    try {
      const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
      // Use animal.ownerId to store the record under the correct owner
      const illnessRecordsCollectionRef = collection(db, 'artifacts', appId, 'users', animal.ownerId, 'animals', animal.id, 'illnessRecords');

      await addDoc(illnessRecordsCollectionRef, {
        symptoms,
        temperature,
        heartRate: heartRate || null,
        respiratoryRate: respiratoryRate || null,
        bloodPressure: bloodPressure || null,
        oxygenSaturation: oxygenSaturation || null,
        diagnosis,
        treatment, // Save treatment
        image: selectedImageBase64,
        timestamp: new Date(),
      });
      setMessage('บันทึกอาการป่วยสำเร็จ! / Illness record saved successfully!');

      const doc = new jsPDF();
      doc.setFont('helvetica');
      doc.setFontSize(16);

      doc.text("Preliminary Diagnosis and Treatment Report for Veterinarian", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, 10, 30);
      doc.text(`Time: ${new Date().toLocaleTimeString('en-US')}`, 10, 37);
      doc.text(`Pet Name: ${animal.name} (HN: ${animal.hn})`, 10, 47);
      doc.text(`Species: ${animal.species}, Breed: ${animal.breed}, Sex: ${animal.sex}`, 10, 54);
      doc.text(`Owner: ${animal.ownerId}`, 10, 61); // Display ownerId

      let currentY = 75;

      if (selectedImageBase64) {
        try {
          const imgData = 'data:image/png;base64,' + selectedImageBase64;
          doc.addImage(imgData, 'PNG', 10, currentY, 50, 50);
          currentY += 60;
          doc.text("ภาพประกอบ: / Accompanying Image:", 10, currentY - 5);
          currentY += 10;
        } catch (imgError) {
          console.error("Error adding image to PDF:", imgError);
          doc.text("ไม่สามารถแสดงรูปภาพได้ใน PDF (อาจเกิดจากขนาดหรือรูปแบบไฟล์) / Image could not be displayed in PDF (due to size or format).", 10, currentY);
          currentY += 10;
        }
      }

      // Ensure symptoms is a string before passing to splitTextToSize
      doc.text("Observed Symptoms:", 10, currentY);
      const symptomsLines = doc.splitTextToSize(String(symptoms || ''), 180);
      doc.text(symptomsLines, 20, currentY + 7);
      currentY += (symptomsLines.length * 7) + 10;

      doc.text(`Temperature: ${temperature || 'Not specified'}`, 10, currentY);
      currentY += 7;

      if (heartRate) { doc.text(`Heart Rate: ${heartRate} bpm`, 10, currentY); currentY += 7; }
      if (respiratoryRate) { doc.text(`Respiratory Rate: ${respiratoryRate} breaths/min`, 10, currentY); currentY += 7; }
      if (bloodPressure) { doc.text(`Blood Pressure: ${bloodPressure} mmHg`, 10, currentY); currentY += 7; }
      if (oxygenSaturation) { doc.text(`Oxygen Saturation: ${oxygenSaturation} %`, 10, currentY); currentY += 7; }
      currentY += 5;

      doc.text("Preliminary Diagnosis (from AI):", 10, currentY + 10);
      currentY += 17;

      // Ensure diagnosis is a string before matching
      const currentDiagnosis = diagnosis || ''; // Use empty string if diagnosis is null/undefined

      const thaiSectionMatch = currentDiagnosis.match(/Thai:\s*([\s\S]*?)(?=\nEnglish:|$)/);
      const englishSectionMatch = currentDiagnosis.match(/English:\s*([\s\S]*)/);

      // Robustly get Thai and English diagnosis, handling cases where match[1] might be undefined
      const thaiDiagnosis = (thaiSectionMatch && thaiSectionMatch[1]) ? thaiSectionMatch[1].trim() : "No Thai diagnosis provided.";
      const englishDiagnosis = (englishSectionMatch && englishSectionMatch[1]) ? englishSectionMatch[1].trim() : "No English diagnosis provided.";

      doc.text("Thai:", 20, currentY);
      currentY += 7;
      // Ensure thaiDiagnosis is a string before passing to splitTextToSize
      const thaiDiagnosisLines = doc.splitTextToSize(String(thaiDiagnosis || ''), 170);
      doc.text(thaiDiagnosisLines, 30, currentY);
      currentY += (thaiDiagnosisLines.length * 7) + 5;

      doc.text("English:", 20, currentY);
      currentY += 7;
      // Ensure englishDiagnosis is a string before passing to splitTextToSize
      const englishDiagnosisLines = doc.splitTextToSize(String(englishDiagnosis || ''), 170);
      doc.text(englishDiagnosisLines, 30, currentY);
      currentY += (englishDiagnosisLines.length * 7) + 10;

      // Add Treatment section
      doc.text("Treatment:", 10, currentY);
      // Ensure treatment is a string before passing to splitTextToSize
      const treatmentLines = doc.splitTextToSize(String(treatment || 'Not specified'), 180);
      doc.text(treatmentLines, 20, currentY + 7);
      currentY += (treatmentLines.length * 7) + 10;

      doc.text("Note: This is an AI-generated preliminary diagnosis. Please consult a veterinarian for accurate diagnosis and treatment.", 10, currentY + 10);

      doc.save(`IllnessReport_${animal.name}_${new Date().toISOString().slice(0, 10)}.pdf`);

      setMessage('บันทึกและสร้าง PDF สำเร็จ! / Saved and PDF generated successfully!');
      onClose();
    } catch (err: any) {
      console.error("Error saving illness record or generating PDF:", err);
      setError("ไม่สามารถบันทึกหรือสร้าง PDF ได้: " + err.message + " / Failed to save or generate PDF: " + err.message);
    }
  };

  return (
    <div className="bg-blue-100 p-6 rounded-lg shadow-sm border border-blue-200 mt-6">
      <h3 className="text-2xl font-bold text-blue-800 mb-4">บันทึกอาการป่วยของ {animal.name} / Record Illness for {animal.name}</h3>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}
      <form className="space-y-4">
        <div>
          <label htmlFor="symptoms" className="block text-gray-700 text-sm font-semibold mb-2">อาการที่สังเกต (กรอกภาษาไทยได้) / Observed Symptoms (Thai input accepted)</label>
          <textarea
            id="symptoms"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 h-24 resize-y"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="เช่น ซึม, ไม่กินอาหาร, อาเจียน, ท้องเสีย... / e.g., Lethargy, loss of appetite, vomiting, diarrhea..."
            required
          ></textarea>
        </div>
        <div>
          <label htmlFor="imageUpload" className="block text-gray-700 text-sm font-semibold mb-2">อัปโหลดรูปภาพ (ไม่บังคับ) / Upload Image (Optional)</label>
          <input
            type="file"
            id="imageUpload"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
          />
          {selectedImageBase64 && (
            <div className="mt-2 text-sm text-gray-600">
              รูปภาพถูกเลือกแล้ว / Image selected.
              <img src={`data:image/png;base64,${selectedImageBase64}`} alt="Illness" className="mt-2 max-h-24 rounded-md" />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="temperature" className="block text-gray-700 text-sm font-semibold mb-2">อุณหภูมิ (องศาเซลเซียส) / Temperature (Celsius)</label>
          <input
            type="number"
            id="temperature"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="เช่น 38.5 / e.g., 38.5"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="heartRate" className="block text-gray-700 text-sm font-semibold mb-2">อัตราการเต้นของหัวใจ (ครั้ง/นาที) / Heart Rate (bpm)</label>
          <input
            type="text"
            id="heartRate"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="เช่น 120 / e.g., 120"
          />
        </div>
        <div>
          <label htmlFor="respiratoryRate" className="block text-gray-700 text-sm font-semibold mb-2">อัตราการหายใจ (ครั้ง/นาที) / Respiratory Rate (breaths/min)</label>
          <input
            type="text"
            id="respiratoryRate"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={respiratoryRate}
            onChange={(e) => setRespiratoryRate(e.target.value)}
            placeholder="เช่น 30 / e.g., 30"
          />
        </div>
        <div>
          <label htmlFor="bloodPressure" className="block text-gray-700 text-sm font-semibold mb-2">ความดันโลหิต (mmHg) / Blood Pressure (mmHg)</label>
          <input
            type="text"
            id="bloodPressure"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-400"
            value={bloodPressure}
            onChange={(e) => setBloodPressure(e.target.value)}
            placeholder="เช่น 120/80 / e.g., 120/80"
          />
        </div>
        <div>
          <label htmlFor="oxygenSaturation" className="block text-gray-700 text-sm font-semibold mb-2">ความอิ่มตัวของออกซิเจน (%) / Oxygen Saturation (%)</label>
          <input
            type="text"
            id="oxygenSaturation"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
            value={oxygenSaturation}
            onChange={(e) => setOxygenSaturation(e.target.value)}
            placeholder="เช่น 98 / e.g., 98"
          />
        </div>

        <button
          type="button"
          onClick={handleAIDiagnosis}
          className="w-full bg-indigo-600 text-white py-3 rounded-md font-semibold text-lg hover:bg-indigo-700 transition duration-200 shadow-sm flex items-center justify-center"
          disabled={loadingAI}
        >
          {loadingAI ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI กำลังประมวลผล... / AI Processing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-1.75-3M3 13V6a2 2 0 012-2h14a2 2 0 012 2v7m-4 6v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6m3-3h.01M17 13l-2 2m0 0l2 2m-2-2l-2-2m2 2l2-2" />
              </svg>
              วินิจฉัยเบื้องต้นด้วย AI / Get AI Diagnosis
            </>
          )}
        </button>

        {diagnosis && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
            <h4 className="text-lg font-semibold text-green-800 mb-2">ผลการวินิจฉัยเบื้องต้นจาก AI: / Preliminary Diagnosis from AI:</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{diagnosis}</p>
          </div>
        )}

        <div>
          <label htmlFor="treatment" className="block text-gray-700 text-sm font-semibold mb-2">การรักษา / Treatment</label>
          <textarea
            id="treatment"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 h-24 resize-y"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="เช่น ยาปฏิชีวนะ, การให้น้ำเกลือ, การผ่าตัด... / e.g., Antibiotics, IV fluids, Surgery..."
          ></textarea>
        </div>

        <div className="flex justify-between space-x-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md font-semibold text-lg hover:bg-gray-600 transition duration-200 shadow-sm"
          >
            ยกเลิก / Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndGeneratePDF}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 transition duration-200 shadow-sm"
            disabled={!diagnosis && !selectedImageBase64}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            บันทึก & สร้าง PDF / Save & Generate PDF
          </button>
        </div>
      </form>
    </div>
  );
}

// Animal Detail Component - Displays animal info and illness history
function AnimalDetail({ animal }: AnimalDetailProps) {
  const context = useContext(AppContext);
  if (!context) throw new Error("AnimalDetail must be used within an AppContext.Provider");
  const { db, setCurrentPage } = context;

  const [showRecordIllness, setShowRecordIllness] = useState<boolean>(false);
  const [illnessHistory, setIllnessHistory] = useState<IllnessRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string>('');

  useEffect(() => {
    if (!db || !animal || !animal.ownerId) {
      setLoadingHistory(false);
      return;
    }

    const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
    const illnessRecordsCollectionRef = collection(db, 'artifacts', appId, 'users', animal.ownerId, 'animals', animal.id, 'illnessRecords');

    // Use orderBy to sort by timestamp descending
    const q = query(illnessRecordsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: IllnessRecord[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IllnessRecord));
      setIllnessHistory(records);
      setLoadingHistory(false);
    }, (err: any) => {
      console.error("Error fetching illness history:", err);
      setHistoryError("ไม่สามารถโหลดประวัติอาการป่วยได้ / Failed to load illness history.");
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [db, animal]); // Re-run when db or animal changes

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">รายละเอียดสัตว์เลี้ยง: {animal.name} / Pet Details: {animal.name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-gray-700 text-lg mb-2"><span className="font-semibold">ชื่อ / Name:</span> {animal.name}</p>
          <p className="text-700 text-lg mb-2"><span className="font-semibold">HN:</span> {animal.hn}</p>
          <p className="text-gray-700 text-lg mb-2"><span className="font-semibold">ชนิด / Species:</span> {animal.species}</p>
          <p className="text-gray-700 text-lg mb-2"><span className="font-semibold">พันธุ์ / Breed:</span> {animal.breed}</p>
          <p className="text-gray-700 text-lg"><span className="font-semibold">เพศ / Sex:</span> {animal.sex}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
          <h3 className="text-xl font-semibold text-blue-800 mb-3">ประวัติอาการป่วย / Illness History</h3>
          {loadingHistory ? (
            <div className="text-center text-gray-600">กำลังโหลดประวัติ... / Loading history...</div>
          ) : historyError ? (
            <div className="text-red-600">{historyError}</div>
          ) : illnessHistory.length === 0 ? (
            <p className="text-gray-600">ยังไม่มีประวัติอาการป่วย / No illness history yet.</p>
          ) : (
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2"> {/* Added scroll for history */}
              {illnessHistory.map((record) => {
                // Determine the date object to use for display
                const displayDate = record.timestamp instanceof Date
                  ? record.timestamp
                  : (record.timestamp as Timestamp).toDate(); // Cast to Timestamp to ensure .toDate() exists

                return (
                  <div key={record.id} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">
                      วันที่: {displayDate.toLocaleDateString('th-TH')}
                      <br/>
                      Date: {displayDate.toLocaleDateString('en-US')}
                    </p>
                    <p className="text-gray-700 text-sm"><span className="font-semibold">อาการ / Symptoms:</span> {record.symptoms}</p>
                    <p className="text-gray-700 text-sm"><span className="font-semibold">อุณหภูมิ / Temp:</span> {record.temperature}°C</p>
                    {/* Ensure record.diagnosis is a string before splitting/trimming */}
                    {record.diagnosis && <p className="text-gray-700 text-sm"><span className="font-semibold">วินิจฉัยเบื้องต้น / Diagnosis:</span> {String(record.diagnosis || '').split('Thai:')[0].trim()}</p>}
                    {record.treatment && <p className="text-gray-700 text-sm"><span className="font-semibold">การรักษา / Treatment:</span> {record.treatment}</p>}
                    {record.image && (
                      <div className="mt-2">
                        <img src={`data:image/png;base64,${record.image}`} alt="Illness" className="max-h-20 rounded-md" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setShowRecordIllness(true)}
          className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-md font-semibold text-lg hover:bg-yellow-700 transition duration-200 shadow-sm flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          บันทึกอาการป่วย / Record Illness
        </button>
        <button
          onClick={() => setCurrentPage('dashboard')}
          className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md font-semibold text-lg hover:bg-gray-600 transition duration-200 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          กลับไปหน้าหลัก / Back to Dashboard
        </button>
      </div>

      {showRecordIllness && (
        <RecordIllnessForm animal={animal} onClose={() => setShowRecordIllness(false)} />
      )}
    </div>
  );
}

// Vet Search Component
function VetSearch() {
  const [location, setLocation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!location) {
      setError("กรุณากรอกตำแหน่งเพื่อค้นหา / Please enter a location to search.");
      return;
    }

    setLoading(true);
    setMessage('กำลังเปิด Google Maps... / Opening Google Maps...');

    const encodedLocation = encodeURIComponent(location);
    const googleSearchUrl = `https://www.google.com/maps/search/สัตวแพทย์ใกล้ฉัน+${encodedLocation}`;
    
    window.open(googleSearchUrl, '_blank');

    setTimeout(() => {
      setLoading(false);
      setMessage('');
      setLocation('');
    }, 2000);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">ค้นหาสัตวแพทย์ใกล้ฉัน / Find Veterinarian Near Me</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}
      <form onSubmit={handleSearch} className="flex items-center space-x-4 mb-6">
        <input
          type="text"
          className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400"
          placeholder="กรอกตำแหน่ง (เช่น กรุงเทพฯ, เชียงใหม่) / Enter location (e.g., Bangkok, Chiang Mai)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 transition duration-200 shadow-sm"
          disabled={loading}
        >
          {loading ? 'กำลังเปิด... / Opening...' : 'ค้นหาบน Google Maps / Search on Google Maps'}
        </button>
      </form>

      <p className="text-gray-600 text-center text-sm mt-4">
        คลิกปุ่มด้านบนเพื่อค้นหาสัตวแพทย์ใกล้เคียงบน Google Maps.
        <br/>
        Click the button above to search for nearby veterinarians on Google Maps.
      </p>
    </div>
  );
}

// Main App Component
function App() {
  const [user, setUser] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentPage, setCurrentPage] = useState<string>('auth');
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      // Firebase configuration (replace with your actual Firebase project config)
      const firebaseConfig = {
        apiKey: "AIzaSyAx3mBjFDuVs155Sm0V1QkeASJnu1MLLVU",
        authDomain: "petcareapp-ffd1b.firebaseapp.com",
        projectId: "petcareapp-ffd1b",
        storageBucket: "petcareapp-ffd1b.firebasestorage.app",
        messagingSenderId: "357366334730",
        appId: "1:357366334730:web:27317ace80e48ad23de6f3"
      };
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
          const userProfileDocRef = doc(firestoreDb, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
          const userProfileSnap = await getDoc(userProfileDocRef);
          if (userProfileSnap.exists()) {
            setUserRole(userProfileSnap.data()?.role || 'user');
          } else {
            // If no profile, assume user role for new sign-ups
            setUserRole('user');
          }
          setCurrentPage('dashboard');
        } else {
          setUser(null);
          setUserRole(null);
          setCurrentPage('auth');
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">กำลังโหลด... / Loading...</div>
      </div>
    );
  }

  const contextValue: AppContextType = { user, db, auth, setCurrentPage, setSelectedAnimal };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-100 font-inter flex flex-col">
        {user && db && auth ? (
          <>
            <Header />
            <main className="container mx-auto p-4 max-w-4xl flex-grow">
              {userRole === 'veterinarian' ? (
                // If veterinarian, show VetDashboard directly
                <VetDashboard />
              ) : (
                // If regular user, show pages based on currentPage state
                <>
                  {currentPage === 'dashboard' && <Dashboard />}
                  {currentPage === 'add-animal' && <AddAnimalForm />}
                  {currentPage === 'animal-detail' && selectedAnimal && <AnimalDetail animal={selectedAnimal} />}
                  {currentPage === 'vet-search' && <VetSearch />}
                </>
              )}
            </main>
            <footer className="bg-gray-800 text-white p-4 mt-8">
              <div className="container mx-auto text-center flex flex-col items-center justify-center">
                <p className="text-sm">
                  เว็ปทดลองสร้างโดยนักเรียนโรงเรียนราชสีมาวิทยาลัย จังหวัดนครราชสีมา ประเทศไทย
                  <br/>
                  Experimental website created by students of Ratchasima Witthayalai School, Nakhon Ratchasima Province, Thailand.
                </p>
              </div>
            </footer>
          </>
        ) : (
          <AuthPage />
        )}
      </div>
    </AppContext.Provider>
  );
}

export default App;
