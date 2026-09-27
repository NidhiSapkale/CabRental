const bookNowButton = document.getElementById('bookNow');

if (bookNowButton) {
  bookNowButton.addEventListener('click', async function () {
    const bookingStatus = document.createElement('div');
    bookingStatus.className = 'booking-status';
    bookingStatus.style.marginTop = '12px';
    bookingStatus.style.fontWeight = '600';
    bookingStatus.style.color = '#1f2937';

    const existingStatus = document.querySelector('.booking-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    const vehicleSelect = document.getElementById('vehicle');
    const pickupDateInput = document.getElementById('pickupDate');
    const dropoffDateInput = document.getElementById('dropoffDate');
    const vehicle = vehicleSelect ? vehicleSelect.value : 'Civic';
    const pickupDate = pickupDateInput ? new Date(pickupDateInput.value) : new Date();
    const dropoffDate = dropoffDateInput ? new Date(dropoffDateInput.value) : new Date(Date.now() + 86400000);
    const vehicleRates = {
      Civic: '0.08',
      'Swift Dzire': '0.06',
      Innova: '0.12',
      Creta: '0.10',
      GrandVistara: '0.09'
    };
    const vehicleId = vehicleSelect ? String(vehicleSelect.selectedIndex || 1) : '1';
    const totalDays = Math.max(1, Math.ceil((dropoffDate - pickupDate) / 86400000) || 1);
    const totalCostInEth = vehicleRates[vehicle] || '0.08';
    const totalCost = Number(totalCostInEth) * totalDays;

    bookingStatus.textContent = 'Connecting wallet and confirming booking...';
    const originalText = bookNowButton.textContent;
    bookNowButton.textContent = 'Processing...';
    bookNowButton.disabled = true;
    const bookingForm = document.querySelector('.booking-form');
    if (bookingForm) {
      bookingForm.appendChild(bookingStatus);
    }

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask and try again.');
      }

      const contract = await connectWallet();
      const tx = await contract.rentVehicle(vehicleId, totalDays, {
        value: ethers.utils.parseEther(totalCost.toFixed(6).toString())
      });
      bookingStatus.style.color = '#047857';
      bookingStatus.textContent = 'Transaction sent. Waiting for confirmation...';
      await tx.wait();
      bookingStatus.style.color = '#047857';
      bookingStatus.textContent = 'Booking confirmed on-chain! Your vehicle has been rented successfully.';
      alert('Booking confirmed!');
    } catch (error) {
      bookingStatus.style.color = '#b91c1c';
      bookingStatus.textContent = error && error.message ? error.message : 'Booking failed. Please try again.';
      alert(error && error.message ? error.message : 'Booking failed. Please try again.');
    } finally {
      bookNowButton.textContent = originalText;
      bookNowButton.disabled = false;
    }
  });
}

document
  .getElementById("view-all-button")
  .addEventListener("click", function () {
    const testimonialsContainer = document.getElementById(
      "testimonials-container"
    );
    const newTestimonials = [
      {
        text: "I've used many cab services before, but this one is by far the best. Highly recommended!",
        client: "- Emily",
        imgSrc: "images/download.jpeg",
      },
      {
        text: "Amazing service! The drivers are professional and the cars are always clean.",
        client: "- Chris",
        imgSrc: "images/istockphoto-1158014305-612x612.jpg",
      },
      {
        text: "Super reliable and affordable. I use their service for all my city travels.",
        client: "- Ashley",
        imgSrc: "images/images (3).jpeg",
      },
      {
        text: "Great experience! The cab arrived on time and the driver was very courteous.",
        client: "- Michael",
        imgSrc: "images/images (4).jpeg",
      },
      {
        text: "Affordable prices and excellent service. Will definitely use again.",
        client: "- Sarah",
        imgSrc: "images/images (5).jpeg",
      },
      {
        text: "Fast and reliable service. The app makes booking so easy.",
        client: "- David",
        imgSrc: "images/images (6).jpeg",
      },
    ];

    // Shuffle the array to get random testimonials each time
    newTestimonials.sort(() => Math.random() - 0.5);

    // Clear existing testimonials
    testimonialsContainer.innerHTML = "";

    // Add the original testimonials back
    const originalTestimonials = [
      {
        text: "Using Cab Rental has made my life so much easier. The service is top-notch and always reliable.",
        client: "- Alex",
        imgSrc: "images/download3.jpeg",
      },
      {
        text: "The best cab rental service I’ve ever used! The drivers are friendly and always on time.",
        client: "- Jordan",
        imgSrc: "images/images.jpeg",
      },
      {
        text: "Excellent service! The booking process is seamless, and the cabs are always clean and comfortable.",
        client: "- Taylor",
        imgSrc: "images/images (4).jpeg",
      },
    ];

    originalTestimonials.forEach((testimonial) => {
      const testimonialDiv = document.createElement("div");
      testimonialDiv.classList.add("testimonial");

      const testimonialText = document.createElement("p");
      testimonialText.textContent = testimonial.text;
      testimonialDiv.appendChild(testimonialText);

      const testimonialClient = document.createElement("p");
      testimonialClient.classList.add("client");
      testimonialClient.textContent = testimonial.client;
      testimonialDiv.appendChild(testimonialClient);

      const testimonialImg = document.createElement("img");
      testimonialImg.src = testimonial.imgSrc;
      testimonialImg.alt = testimonial.client.slice(2);
      testimonialImg.classList.add("client-photo");
      testimonialDiv.appendChild(testimonialImg);

      testimonialsContainer.appendChild(testimonialDiv);
    });

 // Get the button
 let mybutton = document.getElementById("topButton");

 // When the user scrolls down 20px from the top of the document, show the button
 window.onscroll = function() {scrollFunction()};
 
 function scrollFunction() {
     if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
         mybutton.style.display = "block";
     } else {
         mybutton.style.display = "none";
     }
 }
 
 // When the user clicks on the button, scroll to the top of the document
 mybutton.addEventListener("click", function() {
     document.body.scrollTop = 0;
     document.documentElement.scrollTop = 0;
 });
 // When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function() {scrollFunction()};

 
 
    // Add new random testimonials
    newTestimonials.slice(0, 3).forEach((testimonial) => {
      const testimonialDiv = document.createElement("div");
      testimonialDiv.classList.add("testimonial");

      const testimonialText = document.createElement("p");
      testimonialText.textContent = testimonial.text;
      testimonialDiv.appendChild(testimonialText);

      const testimonialClient = document.createElement("p");
      testimonialClient.classList.add("client");
      testimonialClient.textContent = testimonial.client;
      testimonialDiv.appendChild(testimonialClient);

      const testimonialImg = document.createElement("img");
      testimonialImg.src = testimonial.imgSrc;
      testimonialImg.alt = testimonial.client.slice(2);
      testimonialImg.classList.add("client-photo");
      testimonialDiv.appendChild(testimonialImg);

      testimonialsContainer.appendChild(testimonialDiv);
    });
  });
  const themeSwitch = document.getElementById('theme-switch'); // Ensure this matches your HTML button's ID
  const body = document.body;
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  
  // Function to enable dark mode
  function enableDarkMode() {
    themeSwitch.classList.add('dark-theme'); // Update the switch appearance
      body.classList.add('dark-mode');
      header.classList.add('dark-mode');
      footer.classList.add('dark-mode');
  }
  
  // Function to disable dark mode
  function disableDarkMode() {
    themeSwitch.classList.remove('dark-theme'); // Update the switch appearance
      body.classList.remove('dark-mode');
      header.classList.remove('dark-mode');
      footer.classList.remove('dark-mode');
  }
  
  // Event listener for dark mode toggle button
  themeSwitch.addEventListener('click', () => {
      if (body.classList.contains('dark-mode')) {
        localStorage.removeItem('dark-mode'); // Remove from local storage
          disableDarkMode(); // Switch to light mode
      } else {
          enableDarkMode(); // Switch to dark mode
          localStorage.setItem('dark-mode', 'enabled'); // Save in local storage
      }
  });
  
  // Optional: Check the initial mode on page load
  if (localStorage.getItem('dark-mode') === 'enabled') {
      enableDarkMode();
  }
  
  document.addEventListener('DOMContentLoaded', () => {
      console.log("Welcome to ML Fusion Lab!");
  });