// NordPass 2024 上位200パスワードブロックリスト（出典: github.com/Erosion2020/passwdByWeak）
const BLOCKED_LIST = [
  '123456', '123456789', '12345678', 'secret', 'password', 'qwerty123', 'qwerty1',
  '111111', '123123', '1234567890', 'qwerty', '1234567', '11111111', 'abc123',
  'iloveyou', '123123123', '000000', '00000000', 'a123456', 'password1', '654321',
  'qwer4321', '1q2w3e4r5t', '123456a', 'q1w2e3r4t5y6', '987654321', '123321',
  'timelord12', 'qwertyuiop', 'Password', '666666', '112233', 'p@ssw0rd', 'princess',
  '1qaz2wsx3edc', 'asdfghjkl', '88888888', '1234561', 'abcd1234', '121212',
  '1q2w3e4r', 'monkey', 'zxcvbnm', 'a123456789', 'football', 'dragon', 'ashley',
  'baseball', 'sunshine', 'soccer', 'password1', '1qaz2wsx', 'aa123456', '123qwe',
  'fuckyou', 'michael', 'pakistan', 'superman', 'qwerty123', 'qwerty12', 'aaaaaa',
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
  '789456', 'taylor', 'flower', 'abcd1234', 'pepper', '0000000000', 'amanda',
  'samantha', 'tigger', 'qwerty12', 'jasmine', 'iloveyou1', 'q1w2e3r4', '1q2w3e',
  '987654', 'butterfly', 'charlie', '123456d', 'joseph', '87654321', 'asd123456',
  'peanut', 'forever', 'princess1', 'maggie', 'd123456', 'freedom', 'buster',
  'diamond', 'thomas', 'brandon', 'yellow', 'loveyou', 'love123', 'cheese',
  'asshole', '123654789', '456789', 'starwars', 'mother', '777777', 'chicken',
  'aaaaaaaa', 'mustang', 'william', 'letmein', 'welcome1', 'welcome123',
  'samantha1', 'daniel73', 'abcd@1234', '12345678ab', 'qwerty123!', 'qwerty1!',
  'qwerty1?', 'qwerty123?', 'aa123456', 'q1w2e3r4t5y61', '1q2w3e4r5t1',
  // よく使われる記号置換パターン
  'pass@123', 'p@ss123', 'p@ss1234', 'pass@1234', 'passw@rd',
  'p@ssword', 'p@ssw0rd1', 'pa$$word', 'pa$$w0rd',
  'password!', 'password@', 'password#', 'password123!', 'password@123',
  'pass1234!', 'pass@word', 'pass1234', 'pass12345',
  'admin123', 'admin@123', 'admin1234', 'admin@1234',
  'test1234', 'test@123', 'test@1234',
  'hello123', 'hello@123', 'hello1234',
  'welcome@1', 'welcome@123', 'welcome1!',
  'abc@123', 'abc@1234', 'abc123!', 'abc1234!',
  'qwerty@1', 'qwerty@123', 'qwerty1234', 'qwerty123#',
  'letmein1', 'letme1n', 'l3tm3in',
  'iloveyou!', 'iloveyou2', 'iloveyou123',
  'monkey123', 'dragon123', 'master123', 'master@123',
  'sunshine1', 'sunshine!', 'princess!', 'princess123',
  'football1', 'baseball1', 'soccer123',
  'michael1', 'jordan123', 'batman123', 'superman1',
  'trustno1', 'changeme1', 'changeme!', 'change123',
  'login123', 'user1234', 'mypass123', 'mypassword1',
  '1234abcd', '1234@abcd', 'abcd@123',
];

export const blockedPasswords: Set<string> = new Set(
  BLOCKED_LIST.map((p) => p.toLowerCase())
);

export function isBlockedPassword(password: string): boolean {
  return blockedPasswords.has(password.toLowerCase());
}
