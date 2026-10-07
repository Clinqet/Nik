-- Canada sandbox only (clinket-dev on clinket-ca-nonprod). Safe to run more than once: after the first run it changes nothing.
-- Account 50Q98 holds a proven phone saved without "+1" and without its 10-digit key (a hand edit; no app path writes that).
-- The new rule CK_UserProfile_ProvenPhoneSearchable refuses exactly that row, so migration ProvenPhoneNumberUnique
-- cannot apply on Canada until it is fixed. Run with sqlcmd -I (filtered indexes need QUOTED_IDENTIFIER ON).
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

BEGIN TRAN;

UPDATE dbo.UserProfile
   SET PhoneNumber = N'+1' + PhoneNumber,
       PhoneSearchKey = PhoneNumber
 WHERE UserNumber = N'50Q98'
   AND PhoneNumber NOT LIKE N'+%'
   AND CountryCode = N'1'
   AND LEN(PhoneNumber) = 10
   AND PhoneNumber NOT LIKE N'%[^0-9]%';

SELECT @@ROWCOUNT AS RowsFixed;

COMMIT;

-- Must print 0: no proven number left without "+" or its key, anywhere in the database.
SELECT COUNT(*) AS ProvenNumbersTheRuleWouldRefuse
  FROM dbo.UserProfile
 WHERE PhoneNumberConfirmed = 1
   AND PhoneNumber IS NOT NULL
   AND (PhoneNumber NOT LIKE N'+%' OR PhoneSearchKey IS NULL);
