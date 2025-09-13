    const nodemailer = require('nodemailer');

    /**
     * Format number as Macedonian denar currency
     * @param {number} amount - The amount to format
     * @returns {string} - Formatted currency string (e.g., "1.234,50 ден")
     */
    const formatMKD = (amount) => {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return '0 ден';
        }

        // Round to 2 decimal places
        const rounded = Math.round(amount * 100) / 100;
        
        // Convert to string and split on decimal point
        const [integerPart, decimalPart = ''] = rounded.toString().split('.');
        
        // Add thousands separators (dots)
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        // For Macedonian formatting, most prices are whole denars
        // Only show decimals if they exist and are not .00
        const hasDecimals = decimalPart && decimalPart !== '00' && parseFloat('0.' + decimalPart) > 0;
        
        if (hasDecimals) {
            // Ensure we have exactly 2 decimal places, use comma as decimal separator
            const formattedDecimals = decimalPart.padEnd(2, '0').substring(0, 2);
            return `${formattedInteger},${formattedDecimals} ден`;
        } else {
            // No decimals for whole amounts
            return `${formattedInteger} ден`;
        }
    };

    class EmailService {
        constructor() {
            this.transporter = nodemailer.createTransport({
                service: 'gmail', // You can change this to other services like 'outlook', 'yahoo', etc.
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS // Use app password for Gmail
                }
            });
        }

        // Generate order confirmation email HTML template
        generateOrderConfirmationHTML(orderData) {
            const { order, user, cartItems } = orderData;
            
            // Calculate items list HTML with quantity, size, unit price, and line total
            const itemsHTML = cartItems.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; text-align: left;">
                        ${item.product.title}
                        ${item.size ? `<br><small style="color: #7f8c8d;">Големина: ${item.size}</small>` : ''}
                    </td>
                    <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                    <td style="padding: 10px; text-align: center;">${formatMKD(item.unitPrice)}</td>
                    <td style="padding: 10px; text-align: center;"><strong>${formatMKD(item.lineTotal)}</strong></td>
                </tr>
            `).join('');

            return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Потврда за нарачка - MikiKids</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50; text-align: center; margin-bottom: 10px;">Ви благодариме за вашата нарачка!</h1>
                    <p style="text-align: center; font-size: 18px; color: #7f8c8d; margin: 0;">Нарачка #${order._id.toString().slice(-8).toUpperCase()}</p>
                </div>

                <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; border-bottom: 2px solid #333333; padding-bottom: 10px;">Детали за нарачката</h2>
                    
                    <div style="margin-bottom: 20px;">
                        <p><strong>Купувач:</strong> ${order.isGuestOrder ? order.guestInfo.name : user.name}</p>
                        <p><strong>Е-пошта:</strong> ${order.isGuestOrder ? order.guestInfo.email : user.email}</p>
                        <p><strong>Датум на нарачка:</strong> ${new Date(order.createdAt).toLocaleDateString('mk-MK', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</p>
                        <p><strong>Статус:</strong> <span style="background-color: #555555; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">${order.status === 'pending' ? 'во чекање' : order.status === 'processing' ? 'се обработува' : order.status === 'shipped' ? 'испратена' : order.status === 'delivered' ? 'доставена' : order.status === 'cancelled' ? 'откажана' : order.status}</span></p>
                    </div>

                    ${order.address ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">Адреса за достава</h3>
                        <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 0;">${order.address}</p>
                        ${order.phoneNumber ? `<p style="margin-top: 5px;"><strong>Телефон:</strong> ${order.phoneNumber}</p>` : ''}
                    </div>
                    ` : ''}

                    <h3 style="color: #2c3e50; margin-bottom: 15px;">Нарачани производи</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #333333; color: white;">
                                <th style="padding: 12px; text-align: left; border-radius: 4px 0 0 0;">Производ</th>
                                <th style="padding: 12px; text-align: center;">Количина</th>
                                <th style="padding: 12px; text-align: center;">Цена</th>
                                <th style="padding: 12px; text-align: center; border-radius: 0 4px 0 0;">Вкупно</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div style="text-align: right; margin-top: 20px;">
                        ${order.newUserDiscount ? `
                        <div style="margin-bottom: 10px;">
                            <p style="font-size: 16px; margin: 0;">
                                <strong>Попуст за нов купувач: 10% ПОПУСТ!</strong>
                            </p>
                        </div>
                        ` : ''}
                        <h3 style="color: #2c3e50; font-size: 24px; margin: 0;">
                            Вкупно: <span>${formatMKD(order.totalPrice)}</span>
                        </h3>
                    </div>
                </div>

                <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #2c3e50; margin-bottom: 15px;">Што следи?</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>Ќе ја обработиме вашата нарачка во рок од 1-2 работни дена</li>
                        <li>Ќе добиете потврда за испраќање со информации за следење</li>
                        <li>Очекувана достава: 3-5 работни дена</li>
                    </ul>
                </div>

                <div style="text-align: center; padding: 20px; border-top: 1px solid #bdc3c7; margin-top: 30px;">
                    <p style="color: #7f8c8d; margin-bottom: 10px;">Ви благодариме што го избравте MikiKids!</p>
                    <p style="color: #7f8c8d; font-size: 14px; margin: 0;">
                        Ако имате прашања, ве молиме контактирајте не на 
                        <a href="mailto:support@mikikids.com" style="color: #333333; text-decoration: none;">support@mikikids.com</a>
                    </p>
                </div>
            </body>
            </html>
            `;
        }

        // Send order confirmation email
        async sendOrderConfirmation(orderData) {
            try {
                const { order, user } = orderData;
                console.log(order, user);
                const recipientEmail = order.isGuestOrder ? order.guestInfo.email : user.email;
                const recipientName = order.isGuestOrder ? order.guestInfo.name : user.name;

                const mailOptions = {
                    from:  `MikiKids`,
                    to: recipientEmail,
                    subject: `Потврда за нарачка - #${order._id.toString().slice(-8).toUpperCase()}`,
                    html: this.generateOrderConfirmationHTML(orderData),
                    // Also include a plain text version
                    text: `
    Ви благодариме за вашата нарачка!

    Нарачка #${order._id.toString().slice(-8).toUpperCase()}
    Купувач: ${recipientName}
    ${order.newUserDiscount ? 'Попуст за нов купувач: 10% ПОПУСТ!' : ''}
    Вкупно: ${formatMKD(order.totalPrice)}
    Статус: ${order.status === 'pending' ? 'во чекање' : order.status === 'processing' ? 'се обработува' : order.status === 'shipped' ? 'испратена' : order.status === 'delivered' ? 'доставена' : order.status === 'cancelled' ? 'откажана' : order.status}

    Ќе ја обработиме вашата нарачка во рок од 1-2 работни дена и ќе ви испратиме информации за следење.

    Ви благодариме што го избравте MikiKids!
                    `.trim()
                };

                const result = await this.transporter.sendMail(mailOptions);
                console.log('Order confirmation email sent successfully:', result.messageId);
                return { success: true, messageId: result.messageId };
            } catch (error) {
                console.error('Error sending order confirmation email:', error);
                return { success: false, error: error.message };
            }
        }

        // Test email configuration
        async testEmailConnection() {
            try {
                await this.transporter.verify();
                console.log('Email service is ready to send emails');
                return { success: true };
            } catch (error) {
                console.error('Email service configuration error:', error);
                return { success: false, error: error.message };
            }
        }
    }

    module.exports = new EmailService();
