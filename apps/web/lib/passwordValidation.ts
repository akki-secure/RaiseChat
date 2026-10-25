// NordPass 2024 上位200パスワードブロックリスト（出典: github.com/Erosion2020/passwdByWeak）
const BLOCKED_LIST = new Set([
  '123456', '123456789', '12345678', 'secret', 'password', 'qwerty123', 'qwerty1',
  '111111', '123123', '1234567890', 'qwerty', '1234567', '11111111', 'abc123',
  'iloveyou', '123123123', '000000', '00000000', 'a123456', 'password1', '654321',
  'qwer4321', '1q2w3e4r5t', '123456a', 'q1w2e3r4t5y6', '987654321', '123321',
  'timelord12', 'qwertyuiop', 'password', '666666', '112233', 'p@ssw0rd', 'princess',
  '1qaz2wsx3edc', 'asdfghjkl', '88888888', '1234561', 'abcd1234', '121212',
  '1q2w3e4r', 'monkey', 'zxcvbnm', 'a123456789', 'football', 'dragon', 'ashley',
  'baseball', 'sunshine', 'soccer', '1qaz2wsx', 'aa123456', '123qwe',
  'fuckyou', 'michael', 'pakistan', 'superman', 'aaaaaa',
  '123456789a', 'asdasd', 'shadow', '555555', '123abc', '1111111111', '123654',
  'jordan', 'abcd@1234', 'qwe123', 'abcdef', 'killer', 'qq123456', 'nicole',
  '12345678910', 'asdfgh', 'welcome', 'computer', '222222', 'daniel', 'babygirl',
  'changeme', '7777777', 'basketball', '888888', 'michelle', 'justin', 'pokemon',
  'hello', 'asd123', 'lovely', 'purple', 'hunter', '102030', '1111111', '1234567891',
  'qazwsx', 'master', '123456b', 'anthony', 'qwer1234', '1234qwer', 'b123456',
  'jessica', 'joshua', 'andrew', '789456123', '11223344', '999999', '123456c',
  'family', 'c123456', 'password123', '123456123', 'loveme', 'whatever', 'jennifer',
  'hannah', 'summer', '1qaz2wsx3edc1', '1234567890123', 'robert', 'naruto', 'batman',
  'iloveu', 'jordan23', '12341234', '111111111', 'asdf1234', 'cookie', 'matthew',
  '789456', 'taylor', 'flower', 'pepper', '0000000000', 'amanda',
  'samantha', 'tigger', 'qwerty12', 'jasmine', 'iloveyou1', 'q1w2e3r4', '1q2w3e',
  '987654', 'butterfly', 'charlie', '123456d', 'joseph', '87654321', 'asd123456',
  'peanut', 'forever', 'princess1', 'maggie', 'd123456', 'freedom', 'buster',
  'diamond', 'thomas', 'brandon', 'yellow', 'loveyou', 'love123', 'cheese',
  'asshole', '123654789', '456789', 'starwars', 'mother', '777777', 'chicken',
  'aaaaaaaa', 'mustang', 'william', 'letmein', 'welcome1', 'welcome123',
  'samantha1', 'aa123456', '1q2w3e4r5t1',
]);

export interface PasswordValidationResult {
  valid: boolean;
  error: string | null;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'パスワードは8文字以上で入力してください' };
  }
  if (password.length > 100) {
    return { valid: false, error: 'パスワードは100文字以内で入力してください' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'パスワードには英字を含めてください' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'パスワードには数字を含めてください' };
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, error: 'パスワードには記号を含めてください' };
  }
  if (BLOCKED_LIST.has(password.toLowerCase())) {
    return { valid: false, error: 'このパスワードはセキュリティリスクが高いため使用できません' };
  }
  return { valid: true, error: null };
}
