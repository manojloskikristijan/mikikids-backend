# Email Configuration Setup

## Overview

The order confirmation email system has been successfully implemented using Nodemailer. Customers will now receive professional HTML email confirmations after placing orders.

## Environment Variables Required

Add the following environment variables to your `.env` file:

```env
# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
```

## Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification
   - App passwords → Generate a new app password
   - Use this password as `EMAIL_PASS` (not your regular Gmail password)

## Other Email Providers

You can modify the service in `services/emailService.js`:

### Outlook/Hotmail

```javascript
service: "outlook";
```

### Yahoo

```javascript
service: "yahoo";
```

### Custom SMTP

```javascript
host: 'your-smtp-server.com',
port: 587,
secure: false,
auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
}
```

## Features Included

✅ **Professional HTML Email Template**

- Clean, responsive design
- Order details and itemized list
- Customer information
- Order status and tracking info
- Company branding

✅ **Support for Both User Types**

- Registered users (uses user.email and user.name)
- Guest users (uses guestInfo.email and guestInfo.name)

✅ **Error Handling**

- Email failures don't affect order creation
- Comprehensive error logging
- Fallback plain text version

✅ **Order Information Included**

- Order number and date
- Customer details
- Shipping address (if provided)
- Itemized product list with prices
- Total amount
- Order status

## Testing

To test the email configuration, you can add this test endpoint temporarily:

```javascript
// Add to your router for testing
app.get("/test-email", async (req, res) => {
  const result = await emailService.testEmailConnection();
  res.json(result);
});
```

## Email Template Customization

The email template is generated in `services/emailService.js` in the `generateOrderConfirmationHTML()` method. You can customize:

- Colors and styling
- Company logo and branding
- Message content
- Additional information sections

## Security Notes

- Never commit your `.env` file to version control
- Use app passwords, not regular passwords
- Consider using environment-specific email addresses for development/production
