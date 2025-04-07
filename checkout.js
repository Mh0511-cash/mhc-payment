// checkout.js
const CART_STORAGE_KEY = 'shopping_cart';
const PAYMENT_STATUS_KEY = 'payment_status';
const VIETQR_MODAL_ID = 'vietqr-modal';

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

// Khởi tạo giỏ hàng
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

/**
 * Hiển thị giỏ hàng lên trang
 */
function renderCart() {
  const cartBody = document.getElementById('cart-body');
  const totalPriceEl = document.getElementById('total-price');
  const fallbackImage = 'https://via.placeholder.com/80?text=Image+Error';

  cartBody.innerHTML = '';
  
  if (!cart || cart.length === 0) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>Giỏ hàng trống</p>
        </td>
      </tr>`;
    totalPriceEl.textContent = '0 ₫';
    return;
  }

  let totalPrice = 0;
  
  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    totalPrice += subtotal;
    const itemImage = productImages[item.id] || item.img || fallbackImage;

    cartBody.innerHTML += `
      <tr>
        <td>
          <div class="product-info">
            <img src="${itemImage}" class="item-img" alt="${item.name}"
                 onerror="this.src='${fallbackImage}'">
            <span class="product-name">${item.name}</span>
          </div>
        </td>
        <td>${item.price.toLocaleString('vi-VN')} ₫</td>
        <td>
          <div class="quantity-control">
            <span>${item.quantity}</span>
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

  totalPriceEl.textContent = `${totalPrice.toLocaleString('vi-VN')} ₫`;
}

/**
 * Xóa sản phẩm khỏi giỏ hàng
 */
function removeItem(index) {
  if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  }
}

/**
 * Lưu giỏ hàng vào localStorage
 */
function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

/**
 * Tính tổng giá trị đơn hàng
 */
function calculateTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
 * Hiển thị thông báo lỗi thanh toán
 */
function showPaymentError(message) {
  const errorElement = document.getElementById('payment-error');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

/**
 * Tạo chuỗi ngẫu nhiên cho mã đơn hàng
 */
function generateRandomString(length = 8) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sao chép nội dung vào clipboard
 */
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

/**
 * Hiển thị modal VietQR
 */
function showVietQR() {
  const amount = calculateTotal();
  if (amount <= 0) {
    showPaymentError('Giỏ hàng trống! Vui lòng thêm sản phẩm');
    return;
  }

  const modal = document.getElementById(VIETQR_MODAL_ID);
  const paymentContent = `DH${generateRandomString(7)}`;

  // Cập nhật thông tin lên modal
  document.getElementById('qr-amount').textContent = `${amount.toLocaleString('vi-VN')} ₫`;
  document.getElementById('payment-content').textContent = paymentContent;

  // Tạo QR code (sử dụng API VietQR hoặc service tương tự)
  const qrImage = document.getElementById('vietqr-image');
  qrImage.src = `https://api.vietqr.io/image/970418-962QR000003146.jpg?amount=${amount}&addInfo=${encodeURIComponent(paymentContent)}&accountName=DAO%20MINH%20HAI`;

  // Lưu thông tin thanh toán
  localStorage.setItem(PAYMENT_STATUS_KEY, JSON.stringify({
    orderCode: paymentContent,
    amount,
    status: 'pending',
    provider: 'vietqr'
  }));

  modal.style.display = 'flex';
}

/**
 * Ẩn modal VietQR
 */
function hideVietQR() {
  document.getElementById(VIETQR_MODAL_ID).style.display = 'none';
}

/**
 * Khởi tạo trang
 */
function initializePage() {
  renderCart();

  // Xử lý sự kiện click nút thanh toán
  document.getElementById('confirm-payment-button').addEventListener('click', function() {
    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    if (cart.length === 0) {
      showPaymentError('Giỏ hàng trống! Vui lòng thêm sản phẩm');
      return;
    }
    
    switch(selectedMethod) {
      case 'payos':
        processPayOSPayment();
        break;
      case 'sepay':
        processSePayPayment();
        break;
      case 'vietqr':
        showVietQR();
        break;
      default:
        showPaymentError('Vui lòng chọn phương thức thanh toán');
    }
  });

  // Theo dõi thay đổi giỏ hàng từ các tab khác
  window.addEventListener('storage', (e) => {
    if (e.key === CART_STORAGE_KEY) {
      cart = JSON.parse(e.newValue || '[]');
      renderCart();
    }
  });

  // Kiểm tra trạng thái thanh toán trước đó
  const paymentStatus = JSON.parse(localStorage.getItem(PAYMENT_STATUS_KEY));
  if (paymentStatus && paymentStatus.status === 'pending') {
    // Xử lý kiểm tra trạng thái thanh toán nếu cần
  }
}

// Khởi chạy khi trang tải xong
document.addEventListener('DOMContentLoaded', initializePage);

// Expose các hàm cần thiết ra global scope
window.removeItem = removeItem;
window.hideVietQR = hideVietQR;
window.copyToClipboard = copyToClipboard;