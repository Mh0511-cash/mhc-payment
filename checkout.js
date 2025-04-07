const CART_STORAGE_KEY = 'shopping_cart';
const PAYMENT_STATUS_KEY = 'payment_status';
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
const fallbackImageUrl = 'https://via.placeholder.com/80?text=Image+Error';

// Product images mapping
const productImages = {
  'mi-hao-hao': 'https://i.imgur.com/VPBhiHd.png',
  'mi-soi-dau': 'https://i.imgur.com/ZEL4bLO.jpg',
  'banh-oreo': 'https://i.imgur.com/TKreRzg.jpg',
  'snack-khoai-tay': 'https://i.imgur.com/H0V9SFG.jpg',
  'coca-cola': 'https://i.imgur.com/5fTijGk.jpg',
  'keo-mut': 'https://i.imgur.com/SgOahXx.jpg',
  'tra-xanh': 'https://i.imgur.com/N4FcNFa.png',
  'banh-mi-que': 'https://i.imgur.com/3gKR0hO.png'
};

function renderCart() {
  const cartBody = document.getElementById('cart-body');
  cartBody.innerHTML = '';
  let totalPrice = 0;

  if (!cart?.length) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>Giỏ hàng trống</p>
          <a href="index.html" class="continue-btn">Tiếp tục mua sắm</a>
        </td>
      </tr>`;
    document.getElementById('total-price').textContent = '0 ₫';
    return;
  }

  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    totalPrice += subtotal;
    const itemImage = productImages[item.id] || item.img || fallbackImageUrl;

    cartBody.innerHTML += `
      <tr>
        <td>
          <div class="product-info">
            <img src="${itemImage}" class="item-img" alt="${item.name}" 
                 onerror="this.src='${fallbackImageUrl}'">
            <span class="product-name">${item.name}</span>
          </div>
        </td>
        <td>${item.price?.toLocaleString('vi-VN') || '0'} ₫</td>
        <td>
          <div class="quantity-control">
            <button class="quantity-btn" onclick="updateQuantity(${index}, -1)">-</button>
            <input type="number" value="${item.quantity}" class="quantity-input" readonly>
            <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">+</button>
          </div>
        </td>
        <td>${subtotal.toLocaleString('vi-VN')} ₫</td>
        <td>
          <button class="remove-btn" onclick="removeItem(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
  });

  document.getElementById('total-price').textContent = `${totalPrice.toLocaleString('vi-VN')} ₫`;
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  renderCart();
}

function updateQuantity(index, change) {
  if (index >= 0 && index < cart.length) {
    cart[index].quantity = Math.max(1, cart[index].quantity + change);
    saveCart();
  }
}

function removeItem(index) {
  if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
    cart.splice(index, 1);
    saveCart();
  }
}

function clearCart() {
  cart = [];
  localStorage.removeItem(CART_STORAGE_KEY);
  renderCart();
}

function generateRandomString(length) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Đã copy: ' + text);
  });
}

// Cấu hình endpoints
const PAYMENT_ENDPOINTS = {
  payos: {
    create: 'https://payos.mhcomputer.org/api/create-payment',
    success: 'https://payos.mhcomputer.org/payment-success.html',
    cancel: 'https://payos.mhcomputer.org/payment-cancel.html'
  },
  sepay: {
    create: 'https://sepay.mhcomputer.org/api/create-payment',
    success: 'https://sepay.mhcomputer.org/payment-success.html',
    cancel: 'https://sepay.mhcomputer.org/payment-cancel.html'
  }
};

/**
 * Xử lý thanh toán qua PayOS
 */
async function processPayOSPayment() {
  const btn = document.querySelector('.payos-btn');
  btn.classList.add('loading');
  
  try {
    const amount = calculateTotal();
    if (amount <= 0) {
      throw new Error('Giỏ hàng trống! Vui lòng thêm sản phẩm');
    }

    const orderCode = `PAYOS_${generateRandomString(8)}`;
    const description = `Thanh toán đơn hàng #${orderCode}`;
    
    const paymentData = {
      orderCode,
      amount,
      description,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      returnUrl: PAYMENT_ENDPOINTS.payos.success,
      cancelUrl: PAYMENT_ENDPOINTS.payos.cancel
    };

    const response = await fetch(PAYMENT_ENDPOINTS.payos.create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const result = await response.json();
    
    if (result.success && result.paymentUrl) {
      // Lưu thông tin thanh toán
      localStorage.setItem(PAYMENT_STATUS_KEY, JSON.stringify({
        orderCode,
        amount,
        status: 'pending',
        provider: 'payos',
        timestamp: new Date().toISOString(),
        items: cart
      }));
      
      // Xóa giỏ hàng sau khi thanh toán thành công
      localStorage.removeItem(CART_STORAGE_KEY);
      cart = [];
      
      // Chuyển hướng đến trang thanh toán
      window.location.href = result.paymentUrl;
    } else {
      throw new Error(result.message || 'Không thể khởi tạo thanh toán PayOS');
    }
  } catch (error) {
    console.error('PayOS Error:', error);
    showPaymentError(error.message);
  } finally {
    btn.classList.remove('loading');
  }
}

/**
 * Xử lý thanh toán qua SePay
 */
async function processSePayPayment() {
  const btn = document.querySelector('.sepay-btn');
  btn.classList.add('loading');
  
  try {
    const amount = calculateTotal();
    if (amount <= 0) {
      throw new Error('Giỏ hàng trống! Vui lòng thêm sản phẩm');
    }

    const orderData = {
      orderCode: `SEPAY_${generateRandomString(8)}`,
      amount,
      description: "Thanh toán đơn hàng Tạp hóa Bà Trâm",
      items: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      returnUrl: PAYMENT_ENDPOINTS.sepay.success,
      cancelUrl: PAYMENT_ENDPOINTS.sepay.cancel,
      metadata: {
        store: "Tạp hóa Bà Trâm"
      }
    };

    const response = await fetch(PAYMENT_ENDPOINTS.sepay.create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    
    if (result.success && result.paymentUrl) {
      // Lưu thông tin thanh toán
      localStorage.setItem(PAYMENT_STATUS_KEY, JSON.stringify({
        orderCode: orderData.orderCode,
        amount,
        status: 'pending',
        provider: 'sepay',
        timestamp: new Date().toISOString(),
        items: cart
      }));
      
      // Xóa giỏ hàng sau khi thanh toán thành công
      localStorage.removeItem(CART_STORAGE_KEY);
      cart = [];
      
      // Chuyển hướng đến trang thanh toán
      window.location.href = result.paymentUrl;
    } else {
      throw new Error(result.message || 'Không thể khởi tạo thanh toán SePay');
    }
  } catch (error) {
    console.error('SePay Error:', error);
    showPaymentError(error.message);
  } finally {
    btn.classList.remove('loading');
  }
}

function processQRBankPayment() {
  const btn = document.querySelector('.vietqr-btn');
  btn.classList.add('loading');

  setTimeout(() => {
    window.location.href = 'naptien.html';
    btn.classList.remove('loading');
  }, 800);
}

function showVietQR() {
  const modal = document.getElementById('vietqr-modal');
  const totalAmount = calculateTotal();

  if (totalAmount <= 0) {
    showPaymentError('Giỏ hàng trống! Vui lòng thêm sản phẩm trước khi thanh toán');
    return;
  }

  modal.style.display = 'flex';
  const paymentContent = 'DH' + generateRandomString(7);

  document.getElementById('qr-amount').textContent = totalAmount.toLocaleString('vi-VN') + ' ₫';
  document.getElementById('payment-content').textContent = paymentContent;

  const qrContainer = document.querySelector('#vietqr-container .qr-loading');
  const qrImage = document.getElementById('vietqr-image');

  qrContainer.style.display = 'none';
  qrImage.style.display = 'block';
  qrImage.alt = `QR Thanh toán ${totalAmount.toLocaleString('vi-VN')}₫`;

  const qrUrl = new URL('https://api.vietqr.io/image/970418-962QR000003146-qvNJZKZ.jpg');
  qrUrl.searchParams.set('accountName', 'DAO MINH HAI');
  qrUrl.searchParams.set('amount', totalAmount);
  qrUrl.searchParams.set('addInfo', paymentContent);

  qrImage.src = qrUrl.toString();

  localStorage.setItem(
    'currentQRPayment',
    JSON.stringify({
      orderId: paymentContent,
      amount: totalAmount,
      timestamp: new Date().toISOString()
    })
  );
}

function hideVietQR() {
  document.getElementById('vietqr-modal').style.display = 'none';
}

function calculateTotal() {
  if (!cart || cart.length === 0) return 0;
  return cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
}

function showPaymentError(message) {
  const errorElement = document.getElementById('payment-error');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}
/**
 * Xử lý thanh toán qua SePay
 */
async function processSePayPayment() {
  const btn = document.querySelector('.sepay-btn');
  btn.classList.add('loading');
  
  try {
    if (cart.length === 0) {
      throw new Error('Giỏ hàng trống! Vui lòng thêm sản phẩm trước khi thanh toán');
    }

    const orderData = {
      orderCode: `SEPAY_${Date.now()}`,
      amount: calculateTotal(),
      description: "Thanh toán đơn hàng Tạp hóa Bà Trâm",
      items: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      customerName: "Khách hàng Tạp hóa Bà Trâm",
      returnUrl: window.location.origin + '/payment-success.html',
      cancelUrl: window.location.origin + '/payment-cancel.html',
    };

    const response = await fetch('https://sepay.mhcomputer.org/api/payments/sepay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    
    if (result.success && result.paymentUrl) {
      localStorage.setItem('current_payment', JSON.stringify({
        provider: 'sepay',
        orderCode: orderData.orderCode,
        amount: orderData.amount
      }));
      window.location.href = result.paymentUrl;
    } else {
      throw new Error(result.message || 'Không thể khởi tạo thanh toán SePay');
    }
  } catch (error) {
    console.error('SePay Error:', error);
    showPaymentError(error.message);
  } finally {
    btn.classList.remove('loading');
  }
}

// Initialize cart and payment methods
document.addEventListener('DOMContentLoaded', function() {
  renderCart();

  // Payment method handling
  const paymentMethods = document.querySelectorAll('input[name="payment-method"]');
  const confirmBtn = document.getElementById('confirm-payment-button');
  
  paymentMethods.forEach(method => {
    method.addEventListener('change', function() {
      if (this.checked) {
        confirmBtn.classList.remove('payos-btn', 'sepay-btn', 'qrbank-btn', 'vietqr-btn');
        confirmBtn.classList.add(`${this.value}-btn`);
      }
    });
  });
  
  confirmBtn.addEventListener('click', function() {
    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const totalAmount = calculateTotal();
    
    if (totalAmount <= 0) {
      showPaymentError('Giỏ hàng trống! Vui lòng thêm sản phẩm trước khi thanh toán');
      return;
    }
    
    if (selectedMethod === 'payos') {
      processPayOSPayment();
    } else if (selectedMethod === 'sepay') {
      processSePayPayment();
    } else if (selectedMethod === 'qrbank') {
      processQRBankPayment();
    } else if (selectedMethod === 'vietqr') {
      showVietQR();
    }
  });

  // Listen for storage changes from other tabs
  window.addEventListener('storage', function(e) {
    if (e.key === CART_STORAGE_KEY) {
      cart = JSON.parse(e.newValue || '[]');
      renderCart();
    }
  });

  // Check for pending QR payments
  const paymentData = JSON.parse(localStorage.getItem('currentQRPayment'));
  if (paymentData) {
    // Additional logic for pending payments can be added here
  }
});