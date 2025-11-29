const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Limit besar untuk foto base64
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- HELPER FUNCTIONS ---

// Fungsi membaca data dari file JSON
const readData = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // Jika file belum ada, buat struktur default
      const initialData = { outlets: [], menus: [] };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading data:", err);
    return { outlets: [], menus: [] };
  }
};

// Fungsi menulis data ke file JSON
const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing data:", err);
    return false;
  }
};

// --- ROUTES OUTLET ---

// 1. GET All Outlets
app.get('/api/outlets', (req, res) => {
  const data = readData();
  // Format data agar sesuai dengan yang diharapkan frontend
  const mappedOutlets = data.outlets.map(item => ({
    ...item,
    imageOnline: item.image_url, // Mapping field
    // Pastikan properti lain yang dibutuhkan frontend ada
    code: item.code || `${item.block}${item.id}` 
  }));
  // Sort by ID descending (terbaru di atas)
  mappedOutlets.sort((a, b) => b.id - a.id);
  res.json(mappedOutlets);
});

// 2. ADD Outlet
app.post('/api/outlets', (req, res) => {
  const { name, category, block, image } = req.body;
  const db = readData();
  
  // Generate ID baru (ambil ID terbesar + 1)
  const newId = Date.now(); // Gunakan timestamp agar unik
  
  // Hitung nomor blok otomatis (misal A1, A2)
  const existingInBlock = db.outlets.filter(o => o.block === block).length;
  const code = `${block}${existingInBlock + 1}`;

  const newOutlet = {
    id: newId,
    name,
    category,
    block,
    code, 
    image_url: image,
    created_at: new Date().toISOString()
  };

  db.outlets.push(newOutlet);
  writeData(db);

  // Return format yang sesuai frontend
  res.json({ 
    ...newOutlet, 
    imageOnline: image 
  });
});

// 3. UPDATE Outlet
app.put('/api/outlets/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, block, image } = req.body;
  const db = readData();

  const index = db.outlets.findIndex(o => o.id == id);
  if (index !== -1) {
    // Update data
    db.outlets[index] = {
      ...db.outlets[index],
      name,
      category,
      block,
      image_url: image || db.outlets[index].image_url // Keep old image if null
    };
    writeData(db);
    res.json({ message: 'Outlet updated', outlet: db.outlets[index] });
  } else {
    res.status(404).json({ message: 'Outlet not found' });
  }
});

// 4. DELETE Outlet
app.delete('/api/outlets/:id', (req, res) => {
  const { id } = req.params;
  const db = readData();
  
  const initialLength = db.outlets.length;
  db.outlets = db.outlets.filter(o => o.id != id);
  
  // Hapus juga menu yang terkait dengan outlet ini (Cascade Delete manual)
  db.menus = db.menus.filter(m => m.outlet_id != id);

  if (db.outlets.length < initialLength) {
    writeData(db);
    res.json({ message: 'Outlet and its menus deleted' });
  } else {
    res.status(404).json({ message: 'Outlet not found' });
  }
});

// --- ROUTES MENU ---

// 1. GET All Menus
app.get('/api/menus', (req, res) => {
  const data = readData();
  const mappedMenus = data.menus.map(m => ({
    id: m.id,
    outletId: m.outlet_id,
    name: m.name,
    price: m.price,
    imageOnline: m.image_url
  }));
  res.json(mappedMenus);
});

// 2. ADD Menu
app.post('/api/menus', (req, res) => {
  const { outletId, name, price, image } = req.body;
  const db = readData();

  const newId = Date.now();

  const newMenu = {
    id: newId,
    outlet_id: outletId,
    name,
    price,
    image_url: image
  };

  db.menus.push(newMenu);
  writeData(db);

  res.json({ 
    id: newId, 
    outletId, 
    name, 
    price, 
    imageOnline: image 
  });
});

// 3. UPDATE Menu
app.put('/api/menus/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, image } = req.body;
  const db = readData();

  const index = db.menus.findIndex(m => m.id == id);
  if (index !== -1) {
    db.menus[index] = {
      ...db.menus[index],
      name,
      price,
      image_url: image || db.menus[index].image_url
    };
    writeData(db);
    res.json({ message: 'Menu updated' });
  } else {
    res.status(404).json({ message: 'Menu not found' });
  }
});

// 4. DELETE Menu
app.delete('/api/menus/:id', (req, res) => {
  const { id } = req.params;
  const db = readData();

  const initialLength = db.menus.length;
  db.menus = db.menus.filter(m => m.id != id);

  if (db.menus.length < initialLength) {
    writeData(db);
    res.json({ message: 'Menu deleted' });
  } else {
    res.status(404).json({ message: 'Menu not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Data tersimpan di: ${DATA_FILE}`);
});