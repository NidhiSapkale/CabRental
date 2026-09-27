import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

const vehicleSeed = [
  {
    model: 'Honda Civic',
    imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
  },
  {
    model: 'Maruti Swift Dzire',
    imageUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
  },
  {
    model: 'Toyota Innova',
    imageUrl: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
  },
];

export async function seedVehicles() {
  const vehiclesRef = collection(db, 'vehicles');

  for (const vehicle of vehicleSeed) {
    await addDoc(vehiclesRef, vehicle);
  }

  return vehicleSeed.length;
}
