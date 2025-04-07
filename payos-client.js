// payos-client.js - Client-side PayOS integration
class PayOSCheckout {
    constructor(options = {}) {
      // Cấu hình mặc định
      this.apiEndpoint = options.apiEndpoint || '/api/payos';
      this.returnUrl = options.returnUrl || `${window.location.origin}/payment-success.html`;
      this.cancelUrl = options.cancelUrl || `${window.location.origin}/payment-cancel.html`;
      this.orderPrefix = options.orderPrefix || 'MH';
      this.onSuccess = options.onSuccess || this.defaultSuccessHandler;
      this.onError = options.onError || this.defaultErrorHandler;
      this.autoRedirect = options.autoRedirect !== false; // Mặc định true
    }
  
    /**
     * Khởi tạo thanh toán PayOS
     * @param {Object} orderData - Dữ liệu đơn hàng
     * @returns {Promise<Object>} - Kết quả thanh toán
     */
    async initiatePayment(orderData) {
      try {
        // Validate cơ bản
        if (!orderData.amount || orderData.amount <= 0) {
          throw new Error('Số tiền thanh toán không hợp lệ');
        }
  
        // Tạo orderCode nếu không có
        const orderCode = orderData.orderCode || this.generateOrderCode();
        
        // Chuẩn bị payload
        const payload = {
          orderCode,
          amount: Math.round(orderData.amount),
          description: orderData.description || `Thanh toán đơn hàng ${orderCode}`,
          items: this.normalizeItems(orderData.items),
          returnUrl: orderData.returnUrl || this.returnUrl,
          cancelUrl: orderData.cancelUrl || this.cancelUrl,
          metadata: orderData.metadata || {}
        };
  
        // Gọi API
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload)
        });
  
        const result = await this.handleResponse(response);
  
        // Lưu thông tin thanh toán tạm thời
        this.storePaymentInfo(result.paymentId || orderCode, {
          amount: payload.amount,
          items: payload.items,
          timestamp: new Date().toISOString()
        });
  
        // Xử lý kết quả
        if (this.autoRedirect && result.checkoutUrl) {
          this.onSuccess(result);
        }
  
        return result;
  
      } catch (error) {
        this.onError(error);
        throw error;
      }
    }
  
    /**
     * Kiểm tra trạng thái thanh toán
     * @param {string} paymentId - ID thanh toán
     * @returns {Promise<Object>} - Trạng thái thanh toán
     */
    async checkPaymentStatus(paymentId) {
      try {
        const response = await fetch(`${this.apiEndpoint}/${paymentId}/status`);
        return await this.handleResponse(response);
      } catch (error) {
        console.error('Error checking payment status:', error);
        return { 
          success: false, 
          status: 'error',
          message: error.message 
        };
      }
    }
  
    // ========== CÁC PHƯƠNG THỨC HỖ TRỢ ========== //
  
    generateOrderCode() {
      return `${this.orderPrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
  
    normalizeItems(items) {
      if (!items || !Array.isArray(items)) return [];
      
      return items.map(item => ({
        name: String(item.name || 'Sản phẩm').substring(0, 255),
        quantity: Math.max(1, parseInt(item.quantity) || 1),
        price: Math.max(0, parseInt(item.price) || 0)
      }));
    }
  
    async handleResponse(response) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Yêu cầu thanh toán thất bại');
      }
      
      return data;
    }
  
    storePaymentInfo(paymentId, data) {
      try {
        sessionStorage.setItem(`payos_payment_${paymentId}`, JSON.stringify(data));
      } catch (e) {
        console.warn('Could not store payment info:', e);
      }
    }
  
    getPaymentInfo(paymentId) {
      try {
        const data = sessionStorage.getItem(`payos_payment_${paymentId}`);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.warn('Could not retrieve payment info:', e);
        return null;
      }
    }
  
    // ========== DEFAULT HANDLERS ========== //
  
    defaultSuccessHandler(result) {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    }
  
    defaultErrorHandler(error) {
      console.error('PayOS Error:', error);
      
      // Hiển thị thông báo lỗi thân thiện
      const errorMessage = error.message.includes('NetworkError') 
        ? 'Lỗi kết nối mạng. Vui lòng kiểm tra lại kết nối.'
        : error.message;
      
      alert(`Lỗi thanh toán: ${errorMessage}`);
    }
  }
  
  // Export cho cả CommonJS và ES Modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PayOSCheckout;
  } else {
    window.PayOSCheckout = PayOSCheckout;
  }