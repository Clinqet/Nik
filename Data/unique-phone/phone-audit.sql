-- READ-ONLY audit: duplicate phone numbers on UserProfile. SELECT statements only; changes nothing.
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

PRINT '== 1. Totals ==';
SELECT
    COUNT(*)                                                                  AS AllRows,
    SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END)                             AS ActiveRows,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber IS NOT NULL THEN 1 ELSE 0 END) AS ActiveWithPhone,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber IS NOT NULL AND PhoneNumberConfirmed = 1 THEN 1 ELSE 0 END) AS ActiveWithConfirmedPhone,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber IS NOT NULL
              AND (PhoneNumber NOT LIKE '+[1-9]%' OR PhoneNumber LIKE '%[^+0-9]%' OR LEN(PhoneNumber) NOT BETWEEN 9 AND 16)
             THEN 1 ELSE 0 END)                                               AS ActiveNotE164,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber IS NOT NULL AND PhoneSearchKey IS NULL THEN 1 ELSE 0 END) AS ActiveMissingSearchKey,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber IS NOT NULL AND PhoneSearchKey IS NOT NULL
              AND RIGHT(PhoneNumber, LEN(PhoneSearchKey)) <> PhoneSearchKey THEN 1 ELSE 0 END) AS ActiveStaleSearchKey,
    SUM(CASE WHEN IsActive = 1 AND PhoneNumber = '' THEN 1 ELSE 0 END)        AS ActiveEmptyStringPhone
FROM dbo.UserProfile;

PRINT '== 2. Active accounts sharing an exact PhoneNumber ==';
SELECT COUNT(*) AS DuplicateGroups, ISNULL(SUM(Holders), 0) AS AccountsInGroups, ISNULL(SUM(Holders - 1), 0) AS AccountsBeyondFirst
FROM (SELECT PhoneNumber, COUNT(*) AS Holders
      FROM dbo.UserProfile
      WHERE IsActive = 1 AND PhoneNumber IS NOT NULL
      GROUP BY PhoneNumber HAVING COUNT(*) > 1) g;

PRINT '== 3. Active accounts sharing a PhoneSearchKey (last 10 digits) ==';
SELECT COUNT(*) AS DuplicateGroups,
       ISNULL(SUM(Holders), 0) AS AccountsInGroups,
       ISNULL(SUM(CASE WHEN DistinctNumbers > 1 THEN 1 ELSE 0 END), 0) AS GroupsWithDifferentFullNumbers
FROM (SELECT PhoneSearchKey, COUNT(*) AS Holders, COUNT(DISTINCT PhoneNumber) AS DistinctNumbers
      FROM dbo.UserProfile
      WHERE IsActive = 1 AND PhoneSearchKey IS NOT NULL
      GROUP BY PhoneSearchKey HAVING COUNT(*) > 1) g;

PRINT '== 4. Active-vs-deactivated sharing (informational; a filtered index allows these) ==';
SELECT COUNT(DISTINCT a.PhoneSearchKey) AS KeysHeldByActiveAndDeactivated
FROM dbo.UserProfile a
JOIN dbo.UserProfile d ON d.PhoneSearchKey = a.PhoneSearchKey AND d.IsActive = 0
WHERE a.IsActive = 1 AND a.PhoneSearchKey IS NOT NULL;

PRINT '== 5. Every active account in a shared-number group (phone masked) ==';
SELECT
    DENSE_RANK() OVER (ORDER BY u.PhoneSearchKey) AS SharedGroup,
    '***' + RIGHT(u.PhoneNumber, 4)  AS PhoneMasked,
    LEFT(u.PhoneNumber, 3)           AS DialPrefix,
    u.UserNumber,
    u.IsSystemGenerated,
    u.IsAdminProvisioned,
    u.PhoneNumberConfirmed,
    u.EmailConfirmed,
    CASE WHEN u.PasswordHash IS NULL THEN 0 ELSE 1 END AS HasPassword,
    (SELECT COUNT(*) FROM dbo.UserLogin l WHERE l.UserId = u.Id) AS ExternalLogins,
    u.LoginProvider,
    u.CreatedAt,
    u.LastLoginAt,
    STUFF((SELECT ',' + t.UserType FROM dbo.UserUserType t WHERE t.UserId = u.Id FOR XML PATH('')), 1, 1, '') AS UserTypes
FROM dbo.UserProfile u
WHERE u.IsActive = 1
  AND u.PhoneSearchKey IN (SELECT PhoneSearchKey FROM dbo.UserProfile
                           WHERE IsActive = 1 AND PhoneSearchKey IS NOT NULL
                           GROUP BY PhoneSearchKey HAVING COUNT(*) > 1)
ORDER BY u.PhoneSearchKey, u.CreatedAt, u.Id;

PRINT '== 6. Before migration ProvenPhoneNumberUnique: both must be 0 or the migration stops (it changes no data) ==';
SELECT
    (SELECT COUNT(*) FROM (SELECT PhoneSearchKey FROM dbo.UserProfile
                           WHERE IsActive = 1 AND PhoneNumberConfirmed = 1 AND PhoneSearchKey IS NOT NULL
                           GROUP BY PhoneSearchKey HAVING COUNT(*) > 1) d)              AS NumbersProvenByTwoActiveAccounts,
    (SELECT COUNT(*) FROM dbo.UserProfile
      WHERE PhoneNumberConfirmed = 1 AND PhoneNumber IS NOT NULL
        AND (PhoneNumber NOT LIKE '+%' OR PhoneSearchKey IS NULL))                     AS ProvenNumbersWithoutPlusOrKey;
