# Fido OS - ClickUp Naming Conventions

**Version:** 1.0  
**Last Updated:** October 21, 2025  
**Purpose:** Define consistent naming standards for all ClickUp records in Fido OS

---

## 🎯 Core Principle

**Task names should represent the primary identifier that users will scan in list views.**

Custom fields contain all additional metadata and are visible in:
- List view columns (when configured)
- Task detail view (when clicking on a task)
- Filters and search results

---

## 📋 List-by-List Naming Standards

### 1. Customers List

**Task Name Format:** `[Customer Name]`

**Examples:**
- ✅ `John Smith`
- ✅ `Jane Doe`
- ✅ `Acme Corporation`
- ❌ `Test Customer - VIP (John Smith)` ← Too verbose
- ❌ `CUST-001 - John Smith` ← Key should be in custom field

**Rationale:**
- Customer name is the primary identifier humans recognize
- Alphabetically sortable for easy scanning
- VIP status, customer_key, and other metadata visible in custom fields
- Clean, professional appearance in list views

**Custom Fields Contain:**
- `customer_key` - Immutable unique identifier (e.g., "CUST-001")
- `bark_customer_id` - Future BARK system ID
- `Customer Name` - Full customer name (matches task name)
- `VIP` - VIP or Standard status
- `Primary Markets` - Markets where customer has units
- `Status` - Active, Paused, or Cancelled

---

### 2. Units List

**Task Name Format:** `[Full Address]`

**Examples:**
- ✅ `123 Main St, Austin, TX 78701`
- ✅ `456 Oak Ave, Los Angeles, CA 90001`
- ✅ `789 Beach Blvd, Unit 5, Newport Beach, CA 92660`
- ❌ `Test Unit - 123 Main St, Austin` ← Remove "Test Unit" prefix
- ❌ `UNIT-001 - 123 Main St` ← Key should be in custom field

**Rationale:**
- Address is the most recognizable identifier for a service unit
- Easy to identify location at a glance
- Unit key, customer association, and subscription details in custom fields
- Matches how operations team thinks about units ("the Main St location")

**Custom Fields Contain:**
- `unit_key` - Immutable unique identifier (e.g., "UNIT-001")
- `bark_unit_id` - Future BARK system ID
- `customer_key` - Parent customer identifier
- `Address` - Full address (matches task name)
- `Market` - Geographic market (ATX, LAX, etc.)
- `Subscription` - Service subscription type
- `Status` - Active, Paused, or Cancelled

---

### 3. Market Ownership List

**Task Name Format:** `[Market Code]`

**Examples:**
- ✅ `ATX`
- ✅ `LAX`
- ✅ `NPB`
- ✅ `HHH`
- ❌ `Market: ATX` ← Remove "Market:" prefix
- ❌ `Austin (ATX)` ← Use code only, full name in custom field if needed

**Rationale:**
- Market code is the standard identifier used throughout the system
- Consistent with how tickets and units reference markets
- Short, scannable, and unambiguous
- Ops owners and other details visible in custom fields

**Custom Fields Contain:**
- `Market` - Market code (matches task name)
- `Primary Ops Owner` - Primary operations owner (user field)
- `Backup Ops Owner` - Backup operations owner (user field)
- `On-Duty Override` - Temporary override for on-duty assignment

---

### 4. VIP Mapping List

**Task Name Format:** `[Customer Name]`

**Examples:**
- ✅ `John Smith`
- ✅ `Jane Doe`
- ✅ `Acme Corporation`
- ❌ `VIP: John Smith (CUST-001)` ← Too verbose
- ❌ `CUST-001 VIP Mapping` ← Use customer name, not key

**Rationale:**
- Customer name is immediately recognizable to CX team
- Matches naming in Customers list for consistency
- customer_key and CX owner assignment in custom fields
- Easy to scan for "Who is this VIP customer?"

**Custom Fields Contain:**
- `customer_key` - Customer identifier (e.g., "CUST-001")
- `CX Owner` - Dedicated CX owner (user field)

---

### 5. Ops Schedules List

**Task Name Format:** `[Person Name] - [Date]`

**Examples:**
- ✅ `Aliyan Ahmed - 2025-10-21`
- ✅ `Anne Davis - 2025-10-22`
- ✅ `Elaine Foster - 2025-10-23`
- ❌ `Ops Schedule - Aliyan - Oct 21` ← Use ISO date format
- ❌ `2025-10-21 - Aliyan Ahmed` ← Person name first for alphabetical sorting

**Rationale:**
- Person name first allows grouping by person in list views
- Date provides temporal context
- Markets, clock times, and approval status in custom fields
- Easy to scan for "Who's working when?"

**Custom Fields Contain:**
- `Person` - Team member (user field)
- `Role` - Ops or CX
- `Markets` - Markets covered during shift (multi-select)
- `Date` - Schedule date
- `Clock In` - Clock in time (HH:MM format)
- `Clock Out` - Clock out time (HH:MM format)
- `Approved` - Schedule approved for payroll (checkbox)

---

### 6. CX Schedules List

**Task Name Format:** `[Person Name] - [Day of Week]`

**Examples:**
- ✅ `Sarah Johnson - Monday`
- ✅ `Mike Chen - Tuesday`
- ✅ `Lisa Park - Wednesday`
- ❌ `CX Schedule - Sarah - Mon` ← Use full day name
- ❌ `Monday Schedule - Sarah Johnson` ← Person name first

**Rationale:**
- Person name first allows grouping by person
- Day of week provides recurring schedule context
- Clock times and active status in custom fields
- Recurring schedules are template-based, not date-specific

**Custom Fields Contain:**
- `Person` - CX team member (user field)
- `Day of Week` - Recurring day (Monday, Tuesday, etc.)
- `Clock In` - Clock in time (HH:MM format)
- `Clock Out` - Clock out time (HH:MM format)
- `Active` - Schedule currently active (checkbox)

---

### 7. Capacity List

**Task Name Format:** `[Person Name]`

**Examples:**
- ✅ `Aliyan Ahmed`
- ✅ `Anne Davis`
- ✅ `Elaine Foster`
- ❌ `Capacity - Aliyan Ahmed` ← Remove "Capacity" prefix
- ❌ `Aliyan Ahmed - 40h` ← Hours should be in custom field

**Rationale:**
- Person name is the primary identifier
- One capacity record per person
- Weekly capacity and buffer percentage in custom fields
- Simple, clean list view

**Custom Fields Contain:**
- `Person` - Team member (user field)
- `Weekly Capacity` - Total weekly capacity in hours (number)
- `Buffer Percentage` - Buffer percentage for capacity planning (number)

---

## 🔄 Data Import Naming Guidelines

### CSV Import Format

When importing data via CSV, the **first column should be the task name** following the conventions above.

**Example: Customers.csv**
```csv
Task Name,customer_key,Customer Name,VIP,Primary Markets,Status,Notes
John Smith,CUST-001,John Smith,VIP,ATX;LAX,Active,High-value customer
Jane Doe,CUST-002,Jane Doe,Standard,LAX,Active,
```

**Example: Units.csv**
```csv
Task Name,unit_key,customer_key,Address,Market,Subscription,Status
123 Main St Austin TX,UNIT-001,CUST-001,123 Main St Austin TX,ATX,3 ongoing,Active
456 Oak Ave Los Angeles CA,UNIT-002,CUST-002,456 Oak Ave Los Angeles CA,LAX,biweekly,Active
```

---

## 🎨 List View Configuration Recommendations

### Customers List View
**Visible Columns:**
1. Task Name (Customer Name) - Primary sort
2. VIP - Badge/tag for quick identification
3. Primary Markets - Multi-select tags
4. Status - Dropdown indicator
5. customer_key - Reference ID

**Sort:** Alphabetical by task name (A-Z)

### Units List View
**Visible Columns:**
1. Task Name (Address) - Primary sort
2. Market - Dropdown indicator
3. Subscription - Service type
4. Status - Active/Paused/Cancelled
5. customer_key - Parent customer reference

**Sort:** Alphabetical by task name (A-Z) or Group by Market

### Market Ownership List View
**Visible Columns:**
1. Task Name (Market Code) - Primary sort
2. Primary Ops Owner - User avatar
3. Backup Ops Owner - User avatar
4. On-Duty Override - User avatar (if set)

**Sort:** Alphabetical by market code (A-Z)

### VIP Mapping List View
**Visible Columns:**
1. Task Name (Customer Name) - Primary sort
2. customer_key - Reference ID
3. CX Owner - User avatar

**Sort:** Alphabetical by customer name (A-Z)

---

## ✅ Quality Checklist

Before importing or creating records, verify:

- [ ] Task name follows the format for that list type
- [ ] Task name contains NO prefixes like "Test", "Market:", "VIP:", etc.
- [ ] Task name contains NO parenthetical clarifications
- [ ] Task name contains NO internal IDs (customer_key, unit_key, etc.)
- [ ] All metadata is in custom fields, not task name
- [ ] Task name is human-readable and scannable
- [ ] Task name allows alphabetical sorting where appropriate

---

## 🚫 Common Anti-Patterns to Avoid

### ❌ Over-Descriptive Names
```
Bad:  "Test Customer - VIP (John Smith) - CUST-001 - Active"
Good: "John Smith"
```

### ❌ Prefixes and Labels
```
Bad:  "Customer: John Smith"
Bad:  "VIP: John Smith"
Bad:  "Market: ATX"
Good: "John Smith" (in Customers or VIP Mapping)
Good: "ATX" (in Market Ownership)
```

### ❌ Internal IDs in Task Names
```
Bad:  "CUST-001 - John Smith"
Bad:  "UNIT-001 - 123 Main St"
Good: "John Smith" (customer_key in custom field)
Good: "123 Main St, Austin, TX" (unit_key in custom field)
```

### ❌ Redundant Information
```
Bad:  "John Smith - VIP - ATX"
Good: "John Smith" (VIP and markets in custom fields)
```

---

## 📚 Additional Resources

- **Field Manifest:** `/clickup/config/field_manifest.json` - All field IDs
- **Settings:** `/clickup/config/settings.json` - Dropdown options and enumerations
- **Test Data Script:** `/scripts/clickup/create_test_data_v2.js` - Reference implementation
- **Naming Fix Script:** `/scripts/clickup/fix_test_data_naming.js` - Batch update existing records

---

**Document Owner:** Fido OS Technical Team  
**Review Cycle:** Quarterly or when new list types are added  
**Questions:** Refer to Phase 1 completion documentation

