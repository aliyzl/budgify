# Telegram Bot Features - Complete Documentation

## Bot Configuration
- **Bot Username**: `@Accounter_doukhtbartarbot`
- **Bot Token**: Configured in `backend/.env`
- **Link Format**: `https://t.me/Accounter_doukhtbartarbot?start=TOKEN`

## Account Linking
1. User clicks "Link Telegram" in dashboard
2. Backend generates unique authentication token
3. User receives link: `https://t.me/Accounter_doukhtbartarbot?start=TOKEN`
4. User opens link in Telegram
5. Bot validates token and links Telegram account to web account
6. User receives confirmation message

## Notifications for Accountants & Admins

### New Purchase Request
- **Trigger**: Manager creates a new request
- **Recipients**: All Accountants and Admins with linked Telegram accounts
- **Content**:
  - Platform name
  - Plan type (if provided)
  - Cost and currency
  - Department name
  - Requester name
  - Payment frequency
  - Screenshot (if uploaded)
- **Actions Available**:
  - ✅ Approve button
  - ❌ Reject button
  - 🔍 View Details (opens web app)

### Approve/Reject via Telegram
- **Authorization**: Only Accountants and Admins can approve/reject
- **Approve Flow**:
  1. Click "✅ Approve" button
  2. Bot asks for final cost (or type "same")
  3. Request status updated to APPROVED
  4. Manager receives notification
- **Reject Flow**:
  1. Click "❌ Reject" button
  2. Bot asks for rejection reason
  3. Request status updated to REJECTED
  4. Manager receives notification

## Notifications for Managers

### Request Approved
- **Trigger**: Request approved (via Telegram or Web)
- **Content**:
  - Request ID
  - Platform name
  - Final cost
  - Department name
  - Confirmation message

### Request Rejected
- **Trigger**: Request rejected (via Telegram or Web)
- **Content**:
  - Request ID
  - Platform name
  - Department name
  - Rejection reason
  - Guidance message

### Request Activated
- **Trigger**: Request status changed to ACTIVE (via Web)
- **Content**:
  - Request ID
  - Platform name
  - Cost
  - Department name
  - Activation confirmation

### Credentials Added
- **Trigger**: Accountant/Admin adds credentials to request
- **Content**:
  - Request ID
  - Platform name
  - Notification that credentials are securely stored

### Payment Info Updated
- **Trigger**: Accountant/Admin updates payment information
- **Content**:
  - Request ID
  - Platform name
  - Exchange rate (if updated)
  - Local cost (if updated)
  - Payment card ID (if updated)

### Renewal Alert
- **Trigger**: Scheduled daily check (9:00 AM) for subscriptions expiring in 5 days
- **Content**:
  - Platform name
  - Expiration notice
  - Renewal options
- **Actions Available**:
  - ✅ Yes, Renew (creates new request)
  - ❌ No, Cancel (marks as EXPIRED)

## Comments & Communication

### Manager Comments
- **Trigger**: Manager adds comment via Telegram or Web
- **Recipients**: All Accountants with linked Telegram accounts
- **Content**: Comment text with sender name

### Accountant/Admin Comments
- **Trigger**: Accountant/Admin adds comment via Telegram or Web
- **Recipients**: Manager (requester) if linked
- **Content**: Comment text with sender name

## Synchronization

### Web → Telegram
- ✅ Request creation → Notifies accountants/admins
- ✅ Status updates (via web) → Notifies manager
- ✅ Credentials added → Notifies manager
- ✅ Payment info updated → Notifies manager
- ✅ Comments added → Notifies other party

### Telegram → Web
- ✅ Approve/Reject actions → Updates database immediately
- ✅ Comments via Telegram → Saved to database
- ✅ Renewal decisions → Creates new request or updates status

## Authorization & Security

### Who Can Do What
- **Managers**:
  - ✅ Create requests
  - ✅ View their own requests
  - ✅ Add comments
  - ✅ Receive notifications
  - ❌ Cannot approve/reject requests

- **Accountants**:
  - ✅ View all requests
  - ✅ Approve/reject requests (Telegram & Web)
  - ✅ Add credentials
  - ✅ Update payment info
  - ✅ Add comments
  - ✅ Receive new request notifications

- **Admins**:
  - ✅ All accountant permissions
  - ✅ Manage users
  - ✅ Manage departments
  - ✅ Receive new request notifications
  - ✅ Approve/reject requests (Telegram & Web)

## Error Handling
- Invalid tokens are rejected with clear messages
- Authorization checks prevent unauthorized actions
- Failed notifications are logged but don't break the flow
- Photo upload errors fall back to text messages

## Testing Checklist
- [ ] Account linking works
- [ ] New request notifications sent to accountants/admins
- [ ] Approve via Telegram updates database
- [ ] Reject via Telegram updates database
- [ ] Manager receives approval notification
- [ ] Manager receives rejection notification
- [ ] Comments sync between Telegram and Web
- [ ] Renewal alerts work correctly
- [ ] Credentials notification sent
- [ ] Payment info notification sent
- [ ] Authorization checks prevent unauthorized actions

